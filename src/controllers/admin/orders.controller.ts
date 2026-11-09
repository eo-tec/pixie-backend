import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { sendMail, mailConfigured } from '../../services/mail.service';
import {
  correosTrackingUrl,
  localeForCountry,
  receivedEmail,
  shippedEmail,
  Locale,
  OrderForEmail,
} from '../../services/beta-order-emails';

// Pedidos de unidades beta. El webhook de Stripe de la landing (getframe64.com)
// llama a POST /admin/orders/beta con los datos del checkout de un Payment Link
// de beta; Álvaro los lista y los marca enviados con el número de Correos.
// Todo con la clave de admin.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = new Set(['received', 'shipped']);

// Precio unitario por moneda, para sacar la cantidad del importe si el webhook
// no la manda. Formato: "eur:8900,usd:9900".
const UNIT_PRICES: Record<string, number> = Object.fromEntries(
  (process.env.BETA_UNIT_PRICES || 'eur:8900,usd:9900')
    .split(',')
    .map((pair) => pair.split(':').map((s) => s.trim()))
    .filter(([cur, cents]) => cur && Number(cents) > 0)
    .map(([cur, cents]) => [cur.toLowerCase(), Number(cents)]),
);

function str(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return v || undefined;
}

function intOrUndefined(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : undefined;
}

function quantityFor(explicit: unknown, amountCents?: number, currency?: string): number {
  const q = intOrUndefined(explicit);
  if (q && q > 0) return q;
  const unit = currency ? UNIT_PRICES[currency.toLowerCase()] : undefined;
  if (unit && amountCents && amountCents > 0) return Math.max(1, Math.round(amountCents / unit));
  return 1;
}

function shippingFrom(body: any) {
  const s = body?.shipping && typeof body.shipping === 'object' ? body.shipping : {};
  const a = s.address && typeof s.address === 'object' ? s.address : {};
  const address = {
    line1: str(a.line1) ?? null,
    line2: str(a.line2) ?? null,
    city: str(a.city) ?? null,
    state: str(a.state) ?? null,
    postal_code: str(a.postal_code, 32) ?? null,
    country: str(a.country, 2)?.toUpperCase() ?? null,
  };
  return { name: str(s.name) ?? null, address };
}

type Order = Prisma.beta_ordersGetPayload<{}>;

function forEmail(order: Order): OrderForEmail {
  return {
    email: order.email,
    name: order.name,
    phone: order.phone,
    quantity: order.quantity,
    amount_cents: order.amount_cents,
    currency: order.currency,
    locale: (order.locale === 'es' ? 'es' : 'en') as Locale,
    shipping: (order.shipping as OrderForEmail['shipping']) ?? null,
    tracking_number: order.tracking_number,
    tracking_url: order.tracking_url,
  };
}

/**
 * Envía un email una sola vez aunque lleguen dos peticiones a la vez: primero
 * se reclama el envío poniendo la fecha y, si falla, se deja como estaba para
 * que el siguiente intento lo vuelva a probar.
 */
async function sendOnce(
  id: number,
  field: 'received_email_sent_at' | 'shipped_email_sent_at',
  build: () => Promise<Order>,
  template: (o: OrderForEmail) => ReturnType<typeof receivedEmail>,
  force = false,
): Promise<'sent' | 'already' | 'not_configured'> {
  if (!mailConfigured()) return 'not_configured';
  const claimed = await prisma.beta_orders.updateMany({
    where: force ? { id } : { id, [field]: null },
    data: { [field]: new Date() },
  });
  if (claimed.count === 0) return 'already';
  try {
    await sendMail(template(forEmail(await build())));
    return 'sent';
  } catch (err) {
    await prisma.beta_orders.update({ where: { id }, data: { [field]: null } });
    throw err;
  }
}

/**
 * Pedido nuevo desde el webhook de Stripe. Stripe reintenta, así que la sesión
 * de checkout es la clave: la segunda vez no se crea otro pedido ni se repite
 * el email. Si el email falla responde 503 para que Stripe lo reintente.
 */
export async function createBetaOrder(req: Request, res: Response) {
  const body = req.body ?? {};
  const sessionId = str(body.session_id, 255);
  const email = str(body.email)?.toLowerCase();
  if (!sessionId || !email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'session_id and a valid email are required' });
    return;
  }

  const shipping = shippingFrom(body);
  const country = str(body.country, 2)?.toUpperCase() ?? shipping.address.country ?? null;
  const amountCents = intOrUndefined(body.amount_cents);
  const currency = str(body.currency, 8)?.toLowerCase();

  let order: Order;
  let created = false;
  try {
    const existing = await prisma.beta_orders.findUnique({ where: { stripe_session_id: sessionId } });
    if (existing) {
      order = existing;
    } else {
      try {
        order = await prisma.beta_orders.create({
          data: {
            stripe_session_id: sessionId,
            stripe_payment_id: str(body.payment_id, 255),
            email,
            name: str(body.name) ?? shipping.name,
            phone: str(body.phone, 64),
            shipping,
            country,
            quantity: quantityFor(body.quantity, amountCents, currency),
            amount_cents: amountCents,
            currency,
            locale: localeForCountry(country),
          },
        });
        created = true;
      } catch (err) {
        // Dos reintentos a la vez: el segundo choca con el índice único.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          order = await prisma.beta_orders.findUniqueOrThrow({ where: { stripe_session_id: sessionId } });
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('[orders] create beta order', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  try {
    const mail = await sendOnce(
      order.id,
      'received_email_sent_at',
      async () => order,
      receivedEmail,
    );
    if (mail === 'not_configured') console.error('[orders] SMTP not configured: received email not sent', order.id);
    res.json({ ok: true, id: order.id, created, email: mail });
  } catch (err) {
    console.error('[orders] received email', order.id, err);
    res.status(503).json({ error: 'email failed', id: order.id, created });
  }
}

/** Lista de pedidos, los más antiguos primero (orden de envío). */
export async function listBetaOrders(req: Request, res: Response) {
  const status = str(req.query.status, 16);
  if (status && !STATUSES.has(status)) {
    res.status(400).json({ error: 'status must be received or shipped' });
    return;
  }
  try {
    const orders = await prisma.beta_orders.findMany({
      where: status ? { status } : {},
      orderBy: { created_at: 'asc' },
    });
    res.json({ count: orders.length, orders });
  } catch (err) {
    console.error('[orders] list', err);
    res.status(500).json({ error: 'internal' });
  }
}

/**
 * Marca un pedido como enviado con el número de Correos y manda el email
 * «en camino». Repetirlo no reenvía el email salvo con `force: true` (por
 * ejemplo, si el número estaba mal).
 */
export async function markBetaOrderShipped(req: Request, res: Response) {
  const id = intOrUndefined(req.params.id);
  const trackingNumber = str(req.body?.tracking_number, 64)?.replace(/\s+/g, '').toUpperCase();
  const force = req.body?.force === true;
  if (!id) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  let order: Order | null;
  try {
    order = await prisma.beta_orders.findUnique({ where: { id } });
  } catch (err) {
    console.error('[orders] shipped lookup', err);
    res.status(500).json({ error: 'internal' });
    return;
  }
  if (!order) {
    res.status(404).json({ error: 'order not found' });
    return;
  }
  if (!trackingNumber && !order.tracking_number) {
    res.status(400).json({ error: 'tracking_number is required' });
    return;
  }
  if (order.shipped_email_sent_at && !force) {
    res.json({ ok: true, id, email: 'already', order });
    return;
  }

  const number = trackingNumber ?? order.tracking_number!;
  try {
    order = await prisma.beta_orders.update({
      where: { id },
      data: {
        status: 'shipped',
        shipped_at: order.shipped_at ?? new Date(),
        tracking_number: number,
        tracking_url: correosTrackingUrl(number, order.locale === 'es' ? 'es' : 'en'),
      },
    });
  } catch (err) {
    console.error('[orders] shipped update', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  try {
    const saved = order;
    const mail = await sendOnce(id, 'shipped_email_sent_at', async () => saved, shippedEmail, force);
    if (mail === 'not_configured') {
      res.status(503).json({ error: 'SMTP not configured: marked shipped, email not sent', order });
      return;
    }
    res.json({ ok: true, id, email: mail, order });
  } catch (err) {
    console.error('[orders] shipped email', id, err);
    res.status(502).json({ error: 'marked shipped, email failed: call again to retry', order });
  }
}
