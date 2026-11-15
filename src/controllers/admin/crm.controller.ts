import { Request, Response } from 'express';
import { OrderStatus, Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import {
  addStockMovement,
  changeOrderStatus,
  CrmError,
  DEFAULT_VERSION,
  linkUnitToMac,
  nextSn,
  ORDER_STATUSES,
  stockSummary,
  syncAllBetaOrders,
  versionByName,
} from '../../services/crm.service';
import { correosTrackingUrl } from '../../services/beta-order-emails';
import { shipBetaOrder } from './orders.controller';

// CRM / ERP interno: endpoints de /admin/crm/* para la web /admin de la
// landing. Todos con la clave de admin (X-Admin-Key).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function str(value: unknown, max = 500): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return v || null;
}

function int(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : undefined;
}

function id(req: Request): number {
  const n = int(req.params.id);
  if (!n) throw new CrmError(400, 'id no válido');
  return n;
}

/** Solo los campos permitidos que vienen en el body (undefined = no tocar). */
function pick(body: any, fields: Record<string, (v: unknown) => unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, parse] of Object.entries(fields)) {
    if (body && k in body) {
      const v = parse(body[k]);
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

const text = (max = 500) => (v: unknown) => str(v, max);
const integer = (v: unknown) => (v === null ? null : int(v));
const tags = (v: unknown) =>
  Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim().slice(0, 40)) : undefined;
const date = (v: unknown) => (v === null || v === '' ? null : typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v) : undefined);

/** Envuelve un handler: errores del CRM con su código, el resto 500. */
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.json(out);
    } catch (err) {
      if (err instanceof CrmError) {
        res.status(err.status).json({ error: err.message, details: err.details });
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: `Ya existe: ${(err.meta?.target as string[] | undefined)?.join(', ') ?? 'valor duplicado'}` });
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        res.status(404).json({ error: 'No encontrado' });
        return;
      }
      console.error('[crm]', req.method, req.path, err);
      res.status(500).json({ error: 'internal' });
    }
  };

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const CUSTOMER_FIELDS = {
  name: text(200),
  phone: text(64),
  country: (v: unknown) => str(v, 2)?.toUpperCase() ?? (v === null ? null : undefined),
  city: text(120),
  language: text(8),
  status: text(32),
  tags,
  origin: text(120),
  utm_source: text(200),
  utm_medium: text(200),
  utm_campaign: text(200),
  utm_content: text(200),
  utm_term: text(200),
  notes: text(20000),
};

export const listCustomers = handle(async (req) => {
  const q = str(req.query.q, 100);
  const status = str(req.query.status, 32);
  const customers = await prisma.customers.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      orders: { select: { id: true, status: true, quantity: true, amount_cents: true, currency: true, units: { select: { sn: true } } } },
      events: { select: { created_at: true }, orderBy: { created_at: 'desc' }, take: 1 },
    },
    orderBy: { created_at: 'desc' },
  });
  return {
    customers: customers.map(({ events, ...c }) => ({
      ...c,
      frames: c.orders.reduce((n, o) => n + o.quantity, 0),
      spent_cents: c.orders.reduce((n, o) => n + (o.amount_cents ?? 0), 0),
      units: c.orders.flatMap((o) => o.units.map((u) => u.sn)),
      last_activity: events[0]?.created_at ?? c.updated_at,
    })),
  };
});

export const getCustomer = handle(async (req) => {
  const customer = await prisma.customers.findUnique({
    where: { id: id(req) },
    include: {
      orders: {
        include: { version: true, units: true },
        orderBy: { created_at: 'desc' },
      },
      events: { orderBy: { created_at: 'desc' } },
      lead: true,
      public_user: { select: { id: true, username: true } },
    },
  });
  if (!customer) throw new CrmError(404, 'Cliente no encontrado');
  return { customer };
});

export const createCustomer = handle(async (req) => {
  const email = str(req.body?.email, 200)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) throw new CrmError(400, 'Email no válido');
  const lead = await prisma.prelaunch_leads.findUnique({ where: { email } });
  const customer = await prisma.customers.create({
    data: {
      email,
      status: 'lead',
      ...pick(req.body, CUSTOMER_FIELDS),
      ...(lead
        ? {
            lead_id: lead.id,
            utm_source: lead.utm_source,
            utm_medium: lead.utm_medium,
            utm_campaign: lead.utm_campaign,
            utm_content: lead.utm_content,
            utm_term: lead.utm_term,
          }
        : {}),
    },
  });
  await prisma.customer_events.create({
    data: { customer_id: customer.id, type: 'system', title: 'Cliente creado a mano' },
  });
  return { customer };
});

export const updateCustomer = handle(async (req) => {
  const data = pick(req.body, CUSTOMER_FIELDS);
  if (req.body && 'email' in req.body) {
    const email = str(req.body.email, 200)?.toLowerCase();
    if (!email || !EMAIL_RE.test(email)) throw new CrmError(400, 'Email no válido');
    data.email = email;
  }
  const before = await prisma.customers.findUnique({ where: { id: id(req) } });
  if (!before) throw new CrmError(404, 'Cliente no encontrado');
  const customer = await prisma.customers.update({ where: { id: before.id }, data });
  if (data.status && data.status !== before.status) {
    await prisma.customer_events.create({
      data: { customer_id: before.id, type: 'system', title: `Estado: ${before.status} → ${data.status}` },
    });
  }
  return { customer };
});

const EVENT_TYPES = new Set(['note', 'email', 'call', 'meeting', 'system']);

export const addCustomerEvent = handle(async (req) => {
  const type = str(req.body?.type, 16) ?? 'note';
  if (!EVENT_TYPES.has(type)) throw new CrmError(400, 'Tipo no válido');
  const body = str(req.body?.body, 20000);
  const title = str(req.body?.title, 200);
  if (!body && !title) throw new CrmError(400, 'Escribe algo');
  const event = await prisma.customer_events.create({
    data: {
      customer_id: id(req),
      type,
      title,
      body,
      author: str(req.body?.author, 60) ?? 'Álvaro',
      order_id: int(req.body?.order_id) ?? null,
      ...(date(req.body?.created_at) ? { created_at: date(req.body?.created_at)! } : {}),
    },
  });
  return { event };
});

export const deleteCustomerEvent = handle(async (req) => {
  await prisma.customer_events.delete({ where: { id: int(req.params.eventId) ?? -1 } });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

const orderInclude = {
  customer: { select: { id: true, name: true, email: true, country: true, city: true } },
  version: { select: { id: true, name: true } },
  units: { select: { id: true, sn: true, mac: true, status: true } },
} satisfies Prisma.ordersInclude;

export const listOrders = handle(async (req) => {
  const status = str(req.query.status, 16) as OrderStatus | null | undefined;
  if (status && !ORDER_STATUSES.includes(status)) throw new CrmError(400, 'Estado no válido');
  const orders = await prisma.orders.findMany({
    where: status ? { status } : {},
    include: orderInclude,
    orderBy: { created_at: 'asc' },
  });
  return { statuses: ORDER_STATUSES, orders };
});

export const getOrder = handle(async (req) => {
  const order = await prisma.orders.findUnique({
    where: { id: id(req) },
    include: { ...orderInclude, beta_order: true, events: { orderBy: { created_at: 'desc' } }, movements: { include: { part: true } } },
  });
  if (!order) throw new CrmError(404, 'Pedido no encontrado');
  return { order };
});

const ORDER_FIELDS = {
  quantity: integer,
  amount_cents: integer,
  currency: text(8),
  notes: text(20000),
  incidence_note: text(2000),
  tracking_number: text(64),
  tracking_url: text(500),
  ship_by: date,
  paid_at: date,
};

/** Pedido a mano (venta fuera de Stripe, regalo, reposición...). */
export const createOrder = handle(async (req) => {
  const customerId = int(req.body?.customer_id);
  if (!customerId) throw new CrmError(400, 'Falta el cliente');
  const versionId = int(req.body?.version_id) ?? (await versionByName(DEFAULT_VERSION)).id;
  const order = await prisma.orders.create({
    data: {
      customer_id: customerId,
      version_id: versionId,
      quantity: int(req.body?.quantity) ?? 1,
      ...pick(req.body, ORDER_FIELDS),
    } as Prisma.ordersUncheckedCreateInput,
  });
  await prisma.customer_events.create({
    data: { customer_id: customerId, order_id: order.id, type: 'order', title: `Pedido #${order.id} creado` },
  });
  return { order };
});

export const updateOrder = handle(async (req) => {
  const data = pick(req.body, ORDER_FIELDS);
  const versionId = int(req.body?.version_id);
  if (versionId) data.version_id = versionId;
  const current = await prisma.orders.findUnique({ where: { id: id(req) } });
  if (!current) throw new CrmError(404, 'Pedido no encontrado');
  if (current.parts_deducted_at && (('quantity' in data && data.quantity !== current.quantity) || (versionId && versionId !== current.version_id))) {
    throw new CrmError(409, 'Este pedido ya está montado: vuelve a «pendiente» para cambiar cantidad o versión');
  }
  const order = await prisma.orders.update({ where: { id: current.id }, data, include: orderInclude });
  return { order };
});

/**
 * Cambio de estado (kanban). Al pasar a «enviado» con número de Correos y si
 * viene de Stripe, manda el email «en camino» con la lógica de siempre.
 */
export const setOrderStatus = handle(async (req) => {
  const status = str(req.body?.status, 16) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new CrmError(400, 'Estado no válido');
  const orderId = id(req);
  const current = await prisma.orders.findUnique({ where: { id: orderId } });
  if (!current) throw new CrmError(404, 'Pedido no encontrado');

  const tracking = str(req.body?.tracking_number, 64)?.replace(/\s+/g, '').toUpperCase() ?? undefined;
  if (status === 'enviado' && !tracking && !current.tracking_number) {
    throw new CrmError(400, 'Para marcarlo enviado hace falta el número de seguimiento');
  }
  const locale = current.beta_order_id
    ? ((await prisma.beta_orders.findUnique({ where: { id: current.beta_order_id }, select: { locale: true } }))?.locale ?? 'en')
    : 'es';

  const order = await changeOrderStatus(orderId, {
    status,
    tracking_number: tracking,
    tracking_url: tracking ? correosTrackingUrl(tracking, locale === 'es' ? 'es' : 'en') : undefined,
    incidence_note: str(req.body?.incidence_note, 2000) ?? undefined,
    note: str(req.body?.note, 2000) ?? undefined,
    force: req.body?.force === true,
  });

  let email: unknown = null;
  if (status === 'enviado' && current.beta_order_id && req.body?.send_email !== false) {
    const r = await shipBetaOrder(current.beta_order_id, order.tracking_number ?? undefined, req.body?.force_email === true);
    email = { status: r.httpStatus, result: r.body.email ?? r.body.error };
    if (r.httpStatus === 200 && r.body.email === 'sent') {
      await prisma.customer_events.create({
        data: {
          customer_id: order.customer_id,
          order_id: order.id,
          type: 'email',
          author: 'Sistema',
          title: 'Email «tu Frame está en camino» enviado',
          body: `Seguimiento: ${order.tracking_number}`,
        },
      });
    }
  }
  const full = await prisma.orders.findUnique({ where: { id: orderId }, include: orderInclude });
  return { order: full, email };
});

/** Pasa al CRM los pedidos de Stripe (beta_orders) que aún no estén. */
export const syncBetaOrders = handle(async () => syncAllBetaOrders());

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

export const listUnits = handle(async () => {
  const units = await prisma.units.findMany({
    include: {
      version: { select: { id: true, name: true } },
      order: { select: { id: true, status: true, customer: { select: { id: true, name: true, email: true } } } },
      pixie: { select: { id: true, name: true, firmware_version: true, hw_version: true, firmware_version_updated_at: true } },
    },
    orderBy: { sn: 'asc' },
  });
  return { units };
});

export const createUnit = handle(async (req) => {
  const versionId = int(req.body?.version_id) ?? (await versionByName(DEFAULT_VERSION)).id;
  const mac = str(req.body?.mac, 17)?.toUpperCase();
  if (mac && !MAC_RE.test(mac)) throw new CrmError(400, 'MAC no válida (AA:BB:CC:DD:EE:FF)');
  const unit = await prisma.units.create({
    data: {
      sn: str(req.body?.sn, 16)?.toUpperCase() ?? (await nextSn()),
      mac: mac ?? null,
      version_id: versionId,
      firmware_version: int(req.body?.firmware_version) ?? null,
      order_id: int(req.body?.order_id) ?? null,
      status: str(req.body?.status, 16) ?? 'montaje',
      notes: str(req.body?.notes, 5000) ?? null,
      pixie_id: mac ? (await prisma.pixie.findFirst({ where: { mac }, select: { id: true } }))?.id ?? null : null,
    },
  });
  return { unit };
});

export const updateUnit = handle(async (req) => {
  const data: Prisma.unitsUncheckedUpdateInput = pick(req.body, {
    firmware_version: integer,
    status: text(16),
    notes: text(5000),
    order_id: integer,
    version_id: integer,
  });
  if (req.body && 'mac' in req.body) {
    const mac = str(req.body.mac, 17)?.toUpperCase() ?? null;
    if (mac && !MAC_RE.test(mac)) throw new CrmError(400, 'MAC no válida (AA:BB:CC:DD:EE:FF)');
    data.mac = mac;
    data.pixie_id = mac ? (await prisma.pixie.findFirst({ where: { mac }, select: { id: true } }))?.id ?? null : null;
  }
  const unit = await prisma.units.update({ where: { id: id(req) }, data });
  return { unit };
});

/** QC: asignar MAC a una unidad por su SN (también desde /admin/frames/provision). */
export const assignMac = handle(async (req) => {
  const sn = str(req.body?.sn, 16)?.toUpperCase();
  const mac = str(req.body?.mac, 17)?.toUpperCase();
  if (!sn || !mac || !MAC_RE.test(mac)) throw new CrmError(400, 'Hacen falta sn y una MAC válida');
  return { unit: await linkUnitToMac(sn, mac) };
});

// ---------------------------------------------------------------------------
// Stock, piezas y versiones
// ---------------------------------------------------------------------------

export const getStock = handle(async () => {
  const [summary, movements] = await Promise.all([
    stockSummary(),
    prisma.stock_movements.findMany({ include: { part: { select: { name: true, unit: true } } }, orderBy: { created_at: 'desc' }, take: 50 }),
  ]);
  return { ...summary, movements };
});

const PART_FIELDS = { name: text(120), unit: text(16), min_qty: integer, supplier: text(200), notes: text(5000) };

export const createPart = handle(async (req) => {
  const name = str(req.body?.name, 120);
  if (!name) throw new CrmError(400, 'Falta el nombre');
  const part = await prisma.parts.create({ data: { ...pick(req.body, PART_FIELDS), name } as Prisma.partsCreateInput });
  const initial = int(req.body?.stock_qty);
  if (initial !== undefined) {
    if (initial) await addStockMovement({ part_id: part.id, delta: initial, reason: 'ajuste', note: 'Stock inicial' });
    await prisma.parts.update({ where: { id: part.id }, data: { counted_at: new Date() } });
  }
  return { part };
});

export const updatePart = handle(async (req) => {
  const partId = id(req);
  const data = pick(req.body, PART_FIELDS);
  const part = await prisma.parts.update({ where: { id: partId }, data });
  // Cambiar el número a mano = recuento: se apunta como ajuste y la pieza
  // deja de estar «sin dato».
  const counted = int(req.body?.stock_qty);
  if (counted !== undefined) {
    if (counted !== part.stock_qty) {
      await addStockMovement({ part_id: partId, delta: counted - part.stock_qty, reason: 'ajuste', note: 'Recuento' });
    }
    await prisma.parts.update({ where: { id: partId }, data: { counted_at: new Date() } });
  }
  return { part: await prisma.parts.findUnique({ where: { id: partId } }) };
});

const REASONS = new Set(['compra', 'ajuste', 'devolucion', 'fabricacion', 'merma']);

export const createMovement = handle(async (req) => {
  const partId = int(req.body?.part_id);
  const delta = int(req.body?.delta);
  const reason = str(req.body?.reason, 16) ?? 'compra';
  if (!partId || !delta) throw new CrmError(400, 'Hacen falta pieza y cantidad');
  if (!REASONS.has(reason)) throw new CrmError(400, 'Motivo no válido');
  return addStockMovement({ part_id: partId, delta, reason, note: str(req.body?.note, 500) });
});

export const listVersions = handle(async () => ({
  versions: await prisma.frame_versions.findMany({ include: { bom: { include: { part: true } } }, orderBy: { id: 'asc' } }),
}));

export const createVersion = handle(async (req) => {
  const name = str(req.body?.name, 60);
  if (!name) throw new CrmError(400, 'Falta el nombre');
  return {
    version: await prisma.frame_versions.create({
      data: { name, hw_version: str(req.body?.hw_version, 16) ?? null, notes: str(req.body?.notes, 5000) ?? null },
    }),
  };
});

/** Sustituye la receta de una versión: [{ part_id, qty }]. */
export const setBom = handle(async (req) => {
  const versionId = id(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) throw new CrmError(400, 'items debe ser una lista');
  const clean = items
    .map((i: any) => ({ part_id: int(i?.part_id), qty: int(i?.qty) ?? 1 }))
    .filter((i: { part_id?: number; qty: number }) => i.part_id && i.qty > 0) as { part_id: number; qty: number }[];
  await prisma.$transaction([
    prisma.bom_items.deleteMany({ where: { version_id: versionId } }),
    prisma.bom_items.createMany({ data: clean.map((i) => ({ ...i, version_id: versionId })) }),
  ]);
  return { bom: await prisma.bom_items.findMany({ where: { version_id: versionId }, include: { part: true } }) };
});
