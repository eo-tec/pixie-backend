import { OrderStatus, Prisma } from '@prisma/client';
import prisma from './prisma';

// CRM / ERP interno: la lógica que no depende de HTTP, para que la usen tanto
// los endpoints de /admin/crm como el webhook de pedidos beta y el MQTT.

type Tx = Prisma.TransactionClient;

export const ORDER_STATUSES: OrderStatus[] = ['pendiente', 'fabricado', 'qc', 'enviado', 'recibido', 'incidencia'];

/** Estados en los que el Frame ya está montado: sus piezas ya salieron del stock. */
const BUILT: OrderStatus[] = ['fabricado', 'qc', 'enviado', 'recibido'];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  fabricado: 'Fabricado',
  qc: 'QC',
  enviado: 'Enviado',
  recibido: 'Recibido',
  incidencia: 'Incidencia',
};

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, keyof Prisma.ordersUpdateInput>> = {
  fabricado: 'fabricado_at',
  qc: 'qc_at',
  enviado: 'enviado_at',
  recibido: 'recibido_at',
  incidencia: 'incidencia_at',
};

/** Estado de la unidad que corresponde a cada estado del pedido. */
const UNIT_STATUS_FOR: Partial<Record<OrderStatus, string>> = {
  fabricado: 'montaje',
  qc: 'qc_ok',
  enviado: 'enviada',
  recibido: 'activa',
};

export const DEFAULT_VERSION = process.env.CRM_DEFAULT_VERSION || 'beta';

export class CrmError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function formatSn(n: number): string {
  return `FR-${String(n).padStart(4, '0')}`;
}

/** Siguiente número de serie libre (FR-0001, FR-0002...). */
export async function nextSn(tx: Tx = prisma): Promise<string> {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(sn FROM 4) AS INTEGER)) AS max
    FROM "public"."units" WHERE sn ~ '^FR-[0-9]+$'`;
  return formatSn((rows[0]?.max ?? 0) + 1);
}

export async function versionByName(name = DEFAULT_VERSION, tx: Tx = prisma) {
  return tx.frame_versions.upsert({ where: { name }, update: {}, create: { name } });
}

// ---------------------------------------------------------------------------
// Clientes y pedidos desde Stripe
// ---------------------------------------------------------------------------

type BetaOrder = Prisma.beta_ordersGetPayload<{}>;

/**
 * A partir de un pedido beta de Stripe: crea o completa el cliente (por email),
 * le enlaza el lead de la landing para heredar el origen (UTM) y crea el pedido
 * del CRM en «pendiente». Idempotente: si el pedido ya existe no hace nada.
 */
export async function syncBetaOrder(beta: BetaOrder) {
  const existing = await prisma.orders.findUnique({ where: { beta_order_id: beta.id } });
  if (existing) return { order: existing, created: false };

  return prisma.$transaction(async (tx) => {
    const email = beta.email.toLowerCase();
    const lead = await tx.prelaunch_leads.findUnique({ where: { email } });
    const shipping = (beta.shipping ?? {}) as { name?: string | null; address?: { city?: string | null } | null };
    const current = await tx.customers.findUnique({ where: { email } });

    const fill = {
      name: current?.name ?? beta.name ?? shipping.name ?? null,
      phone: current?.phone ?? beta.phone ?? null,
      country: current?.country ?? beta.country ?? null,
      city: current?.city ?? shipping.address?.city ?? null,
      language: current?.language ?? beta.locale,
    };
    const fromLead =
      lead && !current?.lead_id
        ? {
            lead_id: lead.id,
            utm_source: current?.utm_source ?? lead.utm_source,
            utm_medium: current?.utm_medium ?? lead.utm_medium,
            utm_campaign: current?.utm_campaign ?? lead.utm_campaign,
            utm_content: current?.utm_content ?? lead.utm_content,
            utm_term: current?.utm_term ?? lead.utm_term,
            origin: current?.origin ?? originFromUtm(lead.utm_source, lead.source),
          }
        : {};

    const customer = current
      ? await tx.customers.update({
          where: { id: current.id },
          data: {
            ...fill,
            ...fromLead,
            status: current.status === 'lead' ? 'beta_tester' : current.status,
          },
        })
      : await tx.customers.create({
          data: {
            email,
            status: 'beta_tester',
            ...fill,
            ...fromLead,
            origin: fromLead.origin ?? 'Web (Stripe)',
            created_at: beta.created_at,
          },
        });

    const version = await versionByName(DEFAULT_VERSION, tx);
    const order = await tx.orders.create({
      data: {
        customer_id: customer.id,
        version_id: version.id,
        quantity: beta.quantity,
        amount_cents: beta.amount_cents,
        currency: beta.currency,
        paid_at: beta.created_at,
        beta_order_id: beta.id,
        shipping: beta.shipping ?? undefined,
        created_at: beta.created_at,
      },
    });
    await tx.customer_events.create({
      data: {
        customer_id: customer.id,
        order_id: order.id,
        type: 'order',
        author: 'Stripe',
        title: `Pedido #${order.id} pagado`,
        body: `${beta.quantity} × Frame ${version.name}${
          beta.amount_cents ? ` · ${(beta.amount_cents / 100).toFixed(2)} ${(beta.currency ?? '').toUpperCase()}` : ''
        }`,
        created_at: beta.created_at,
      },
    });
    return { order, created: true };
  });
}

function originFromUtm(utmSource?: string | null, source?: string | null): string | null {
  const s = (utmSource || source || '').toLowerCase();
  if (!s) return null;
  if (['fb', 'facebook', 'meta', 'ig', 'instagram'].some((k) => s.includes(k))) return 'Meta Ads';
  if (s.includes('reddit')) return 'Reddit';
  if (s.includes('google')) return 'Google';
  if (s.includes('email') || s.includes('newsletter')) return 'Email';
  return utmSource || source || null;
}

/** Pasa al CRM los pedidos beta que todavía no tienen pedido (backfill). */
export async function syncAllBetaOrders() {
  const pending = await prisma.beta_orders.findMany({
    where: { crm_order: null },
    orderBy: { created_at: 'asc' },
  });
  let created = 0;
  for (const beta of pending) {
    const r = await syncBetaOrder(beta);
    if (r.created) created++;
  }
  return { checked: pending.length, created };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/** Piezas que necesita un pedido (BOM × cantidad). */
async function partsFor(tx: Tx, versionId: number, quantity: number) {
  const bom = await tx.bom_items.findMany({ where: { version_id: versionId }, include: { part: true } });
  return bom.map((b) => ({ part: b.part, qty: b.qty * quantity }));
}

/**
 * Resumen del stock: por pieza, cuántas hay, cuántas están comprometidas por
 * pedidos pendientes (aún sin montar) y cuántas quedan libres; por versión,
 * cuántos Frames se pueden montar ahora y qué pieza limita.
 */
export async function stockSummary() {
  const [parts, versions, pending] = await Promise.all([
    prisma.parts.findMany({ orderBy: { id: 'asc' } }),
    prisma.frame_versions.findMany({ where: { active: true }, include: { bom: true }, orderBy: { id: 'asc' } }),
    prisma.orders.findMany({ where: { parts_deducted_at: null, status: 'pendiente' }, select: { version_id: true, quantity: true } }),
  ]);

  const committed = new Map<number, number>();
  const pendingUnits = new Map<number, number>();
  for (const o of pending) {
    pendingUnits.set(o.version_id, (pendingUnits.get(o.version_id) ?? 0) + o.quantity);
    const v = versions.find((x) => x.id === o.version_id);
    for (const b of v?.bom ?? []) committed.set(b.part_id, (committed.get(b.part_id) ?? 0) + b.qty * o.quantity);
  }

  const partRows = parts.map((p) => {
    const c = committed.get(p.id) ?? 0;
    return {
      ...p,
      known: p.counted_at !== null,
      committed: c,
      free: p.stock_qty - c,
      low: p.stock_qty - c < p.min_qty,
      /** Cuántas hay que comprar para cubrir los pedidos pendientes */
      to_buy: Math.max(0, c - Math.max(0, p.stock_qty)),
    };
  });

  const versionRows = versions.map((v) => {
    const lines = v.bom.map((b) => {
      const p = partRows.find((x) => x.id === b.part_id)!;
      // Sin recuento cuenta como 0: mejor no prometer lo que no sabemos.
      const have = p.known ? Math.max(0, p.stock_qty) : 0;
      return { part: p, qty: b.qty, n: Math.floor(have / b.qty), nf: Math.floor(Math.max(0, have - p.committed) / b.qty) };
    });
    const buildable = lines.length ? Math.min(...lines.map((l) => l.n)) : 0;
    const buildableFree = lines.length ? Math.min(...lines.map((l) => l.nf)) : 0;
    // Todas las piezas que limitan (puede haber empate), las de 0 primero
    const blocking = lines
      .filter((l) => l.n === buildable)
      .map((l) => ({ part_id: l.part.id, name: l.part.name, have: l.part.known ? l.part.stock_qty : null, known: l.part.known }));
    const pendingCount = pendingUnits.get(v.id) ?? 0;
    // Lo que falta comprar para montar todos los pedidos pendientes
    const shortfall = lines
      .map((l) => {
        const need = l.qty * pendingCount;
        const have = l.part.known ? Math.max(0, l.part.stock_qty) : 0;
        return { part_id: l.part.id, name: l.part.name, need, have: l.part.known ? l.part.stock_qty : null, known: l.part.known, buy: Math.max(0, need - have) };
      })
      .filter((s) => s.buy > 0);
    return {
      id: v.id,
      name: v.name,
      hw_version: v.hw_version,
      bom: v.bom.map((b) => ({ part_id: b.part_id, qty: b.qty })),
      buildable,
      limiting: blocking[0]?.name ?? null,
      blocking,
      pending_units: pendingCount,
      buildable_after_pending: buildableFree,
      shortfall,
    };
  });

  return { parts: partRows, versions: versionRows };
}

export async function addStockMovement(input: {
  part_id: number;
  delta: number;
  reason: string;
  note?: string | null;
  author?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.stock_movements.create({
      data: {
        part_id: input.part_id,
        delta: input.delta,
        reason: input.reason,
        note: input.note ?? null,
        author: input.author ?? 'Álvaro',
      },
    });
    const part = await tx.parts.update({
      where: { id: input.part_id },
      data: { stock_qty: { increment: input.delta } },
    });
    return { movement, part };
  });
}

// ---------------------------------------------------------------------------
// Estados del pedido
// ---------------------------------------------------------------------------

export interface StatusChange {
  status: OrderStatus;
  tracking_number?: string;
  tracking_url?: string;
  incidence_note?: string;
  note?: string;
  author?: string;
  /** Montar aunque falten piezas (el stock queda en negativo). */
  force?: boolean;
}

/**
 * Mueve un pedido de estado y hace lo que toca:
 * - al montarlo (fabricado o cualquier estado posterior, la primera vez)
 *   descuenta las piezas de su versión y crea sus unidades con número de serie;
 * - si vuelve a «pendiente» devuelve las piezas al stock;
 * - lleva las unidades al estado equivalente (enviada, activa...);
 * - apunta el cambio en el timeline del cliente.
 * El email de «enviado» lo manda el controlador, fuera de la transacción.
 */
export async function changeOrderStatus(orderId: number, change: StatusChange) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.orders.findUnique({ where: { id: orderId }, include: { units: true } });
    if (!order) throw new CrmError(404, 'Pedido no encontrado');
    const to = change.status;
    const from = order.status;
    const now = new Date();
    const data: Prisma.ordersUpdateInput = { status: to };
    const stamp = STATUS_TIMESTAMP[to];
    if (stamp) (data as any)[stamp] = now;
    if (change.tracking_number) data.tracking_number = change.tracking_number;
    if (change.tracking_url) data.tracking_url = change.tracking_url;
    if (to === 'incidencia' && change.incidence_note) data.incidence_note = change.incidence_note;

    const notes: string[] = [];

    // Descontar piezas al montarlo
    if (BUILT.includes(to) && !order.parts_deducted_at) {
      const need = await partsFor(tx, order.version_id, order.quantity);
      const missing = need.filter((n) => n.part.stock_qty < n.qty);
      if (missing.length && !change.force) {
        throw new CrmError(
          409,
          `Falta stock: ${missing.map((m) => `${m.part.name} (necesitas ${m.qty}, hay ${m.part.stock_qty})`).join(', ')}`,
          { missing: missing.map((m) => ({ part_id: m.part.id, name: m.part.name, need: m.qty, have: m.part.stock_qty })) },
        );
      }
      for (const n of need) {
        await tx.parts.update({ where: { id: n.part.id }, data: { stock_qty: { decrement: n.qty } } });
        await tx.stock_movements.create({
          data: { part_id: n.part.id, delta: -n.qty, reason: 'fabricacion', order_id: order.id, note: `Pedido #${order.id}` },
        });
      }
      data.parts_deducted_at = now;
      if (need.length) notes.push(`Piezas descontadas del stock (${need.length} tipos)`);
    }

    // Unidades con su número de serie (también si se montó antes del CRM y
    // las piezas ya estaban descontadas)
    if (BUILT.includes(to)) {
      const missingUnits = order.quantity - order.units.length;
      const sns: string[] = [];
      for (let i = 0; i < missingUnits; i++) {
        const sn = await nextSn(tx);
        await tx.units.create({ data: { sn, version_id: order.version_id, order_id: order.id } });
        sns.push(sn);
      }
      if (sns.length) notes.push(`Unidades creadas: ${sns.join(', ')}`);
    }

    // Devolver piezas si se deshace el montaje
    if (to === 'pendiente' && order.parts_deducted_at) {
      const need = await partsFor(tx, order.version_id, order.quantity);
      for (const n of need) {
        await tx.parts.update({ where: { id: n.part.id }, data: { stock_qty: { increment: n.qty } } });
        await tx.stock_movements.create({
          data: { part_id: n.part.id, delta: n.qty, reason: 'devolucion', order_id: order.id, note: `Pedido #${order.id} vuelve a pendiente` },
        });
      }
      data.parts_deducted_at = null;
      notes.push('Piezas devueltas al stock');
    }

    const unitStatus = UNIT_STATUS_FOR[to];
    if (unitStatus) await tx.units.updateMany({ where: { order_id: order.id, status: { notIn: ['rma', 'baja'] } }, data: { status: unitStatus } });

    const updated = await tx.orders.update({ where: { id: order.id }, data });

    if (from !== to || change.note) {
      const body = [
        change.tracking_number ? `Seguimiento: ${change.tracking_number}` : null,
        to === 'incidencia' ? change.incidence_note : null,
        change.note,
        ...notes,
      ]
        .filter(Boolean)
        .join('\n');
      await tx.customer_events.create({
        data: {
          customer_id: order.customer_id,
          order_id: order.id,
          type: 'order',
          author: change.author ?? 'Álvaro',
          title: from === to ? `Pedido #${order.id}` : `Pedido #${order.id}: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}`,
          body: body || null,
        },
      });
    }
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Hooks del frame (MQTT / provisión)
// ---------------------------------------------------------------------------

/**
 * El frame se ha conectado (pide OTA al arrancar). Guarda su firmware en la
 * unidad y, si su pedido estaba «enviado», lo pasa a «recibido»: la primera
 * conexión en casa del cliente es la mejor señal de entrega que tenemos.
 * Solo actúa si la unidad está enlazada al pixie (MAC asignada en QC), así que
 * los arranques en el taller durante QC no lo disparan (el pedido aún no está
 * enviado). Nunca lanza: el MQTT no debe caerse por el CRM.
 */
export async function onFrameOnline(pixieId: number, firmwareVersion?: number) {
  try {
    const unit = await prisma.units.findUnique({ where: { pixie_id: pixieId }, include: { order: true } });
    if (!unit) return;
    if (typeof firmwareVersion === 'number' && unit.firmware_version !== firmwareVersion) {
      await prisma.units.update({ where: { id: unit.id }, data: { firmware_version: firmwareVersion } });
    }
    if (unit.order?.status === 'enviado') {
      await changeOrderStatus(unit.order.id, {
        status: 'recibido',
        author: 'Frame',
        note: `${unit.sn} se ha conectado por primera vez`,
      });
      console.log(`[crm] pedido #${unit.order.id} recibido: ${unit.sn} conectado (pixie ${pixieId})`);
    }
  } catch (err) {
    console.warn(`[crm] onFrameOnline pixie ${pixieId}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * En QC: enlaza una unidad (por SN) con la MAC del frame y su pixie. Lo llama
 * /admin/frames/provision si recibe `sn`, o el PATCH de la unidad.
 */
export async function linkUnitToMac(sn: string, mac: string, pixieId?: number) {
  const unit = await prisma.units.findUnique({ where: { sn } });
  if (!unit) throw new CrmError(404, `No existe la unidad ${sn}`);
  const pixie = pixieId ? { id: pixieId } : await prisma.pixie.findFirst({ where: { mac }, select: { id: true } });
  return prisma.units.update({
    where: { id: unit.id },
    data: { mac, pixie_id: pixie?.id ?? null, status: unit.status === 'montaje' ? 'qc_ok' : unit.status },
  });
}
