import { Mail } from './mail.service';

// Emails de los pedidos de unidades beta, en texto plano para leer en el móvil.
// Estilo: sin guiones en el texto, «we» para la empresa y el equipo, «I» solo
// para lo personal; en castellano el saludo es «Hola {nombre},».
// Idioma: castellano si el envío va a España, inglés en el resto.

export type Locale = 'es' | 'en';

export interface ShippingAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface OrderForEmail {
  email: string;
  name?: string | null;
  phone?: string | null;
  quantity: number;
  amount_cents?: number | null;
  currency?: string | null;
  locale: Locale;
  shipping?: { name?: string | null; address?: ShippingAddress | null } | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
}

export function localeForCountry(country?: string | null): Locale {
  return country?.toUpperCase() === 'ES' ? 'es' : 'en';
}

/** Correos: página pública de seguimiento, en castellano o en inglés. */
export function correosTrackingUrl(trackingNumber: string, locale: Locale): string {
  const n = encodeURIComponent(trackingNumber.trim().toUpperCase());
  return locale === 'es'
    ? `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${n}`
    : `https://www.correos.es/es/en/tools/tracker/items/details?tracking-number=${n}`;
}

function firstName(order: OrderForEmail): string | undefined {
  const full = order.name?.trim() || order.shipping?.name?.trim();
  return full ? full.split(/\s+/)[0] : undefined;
}

/** 8900 eur → «89 €» en castellano y «€89» en inglés; 9900 usd → «$99». */
export function formatAmount(cents: number, currency: string, locale: Locale): string {
  const cur = currency.toUpperCase();
  const value = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  const shown = locale === 'es' ? value.replace('.', ',') : value;
  const symbol = cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur === 'GBP' ? '£' : null;
  if (!symbol) return `${shown} ${cur}`;
  if (cur === 'EUR' && locale === 'es') return `${shown} €`;
  if (cur === 'USD' && locale === 'es') return `${shown} $`;
  return `${symbol}${shown}`;
}

function addressLines(order: OrderForEmail): string[] {
  const a = order.shipping?.address;
  if (!a) return [];
  // EE. UU. y Canadá: «Portland, OR 97201». Resto: «28001 Madrid» (Stripe da
  // la provincia española como código, «M», que no aporta nada).
  const northAmerica = a.country === 'US' || a.country === 'CA';
  const cityLine = northAmerica
    ? [[a.city, a.state].filter(Boolean).join(', '), a.postal_code].filter(Boolean).join(' ')
    : [a.postal_code, a.city].filter(Boolean).join(' ');
  return [order.shipping?.name, a.line1, a.line2, cityLine, a.country]
    .map((l) => (l ?? '').trim())
    .filter(Boolean);
}

function shippingBlock(order: OrderForEmail, locale: Locale): string {
  const lines = addressLines(order);
  if (!lines.length && !order.phone) return '';
  const header = locale === 'es' ? 'Lo enviaremos a:' : "We'll ship it to:";
  const phone = order.phone ? [(locale === 'es' ? 'Teléfono: ' : 'Phone: ') + order.phone] : [];
  return [header, ...lines, ...phone].join('\n') + '\n\n';
}

const SIGNATURE = 'Álvaro\nFrame';

export function receivedEmail(order: OrderForEmail): Mail {
  const name = firstName(order);
  const n = order.quantity;
  const amount =
    order.amount_cents != null && order.currency
      ? formatAmount(order.amount_cents, order.currency, order.locale)
      : null;

  if (order.locale === 'es') {
    const units = n === 1 ? '1 unidad' : `${n} unidades`;
    return {
      to: order.email,
      subject: n === 1 ? 'Tu Frame beta está confirmado' : 'Tus Frame beta están confirmados',
      text:
        `${name ? `Hola ${name},` : 'Hola,'}\n\n` +
        'Gracias por unirte como beta tester de Frame. Eres de las primeras personas en tenerlo, y eso para mí significa mucho.\n\n' +
        `Confirmamos tu pedido: ${units}${amount ? ` por ${amount}` : ''}.\n\n` +
        shippingBlock(order, 'es') +
        'Montamos cada Frame a mano. En cuanto salga el tuyo te mandaremos el número de seguimiento.\n\n' +
        'Si ves algún error en la dirección o en el teléfono, responde a este email y lo corregimos.\n\n' +
        `Un abrazo,\n${SIGNATURE}\n`,
    };
  }

  const units = n === 1 ? '1 unit' : `${n} units`;
  return {
    to: order.email,
    subject: 'Your Frame beta order is confirmed',
    text:
      `${name ? `Hi ${name},` : 'Hi,'}\n\n` +
      "Thank you for joining Frame as a beta tester. You're one of the very first people to have one, and that means a lot to me.\n\n" +
      `We've confirmed your order: ${units}${amount ? ` for ${amount}` : ''}.\n\n` +
      shippingBlock(order, 'en') +
      "We build every Frame by hand, and we'll send you the tracking number as soon as yours ships.\n\n" +
      "If anything in the address or phone number is wrong, just reply to this email and we'll fix it.\n\n" +
      `Thanks,\n${SIGNATURE}\n`,
  };
}

export function shippedEmail(order: OrderForEmail): Mail {
  const name = firstName(order);
  const many = order.quantity > 1;
  const number = order.tracking_number ?? '';
  const url = order.tracking_url ?? correosTrackingUrl(number, order.locale);

  if (order.locale === 'es') {
    return {
      to: order.email,
      subject: many ? 'Tus Frame ya están en camino' : 'Tu Frame ya está en camino',
      text:
        `${name ? `Hola ${name},` : 'Hola,'}\n\n` +
        (many ? 'Tus Frame ya han salido de Valencia.\n\n' : 'Tu Frame ya ha salido de Valencia.\n\n') +
        `Número de seguimiento: ${number}\n` +
        `Síguelo aquí: ${url}\n\n` +
        'Va por Correos con seguimiento y suele llegar en 2 a 4 días hábiles. Te lo entregan en casa, sin necesidad de firmar.\n\n' +
        'Cuando llegue, cuéntanos qué tal. Basta con responder a este email.\n\n' +
        `Un abrazo,\n${SIGNATURE}\n`,
    };
  }

  return {
    to: order.email,
    subject: many ? 'Your Frames are on the way' : 'Your Frame is on the way',
    text:
      `${name ? `Hi ${name},` : 'Hi,'}\n\n` +
      (many
        ? 'Your Frames have left Valencia and are on their way to you.\n\n'
        : 'Your Frame has left Valencia and is on its way to you.\n\n') +
      `Tracking number: ${number}\n` +
      `Track it here: ${url}\n\n` +
      'It travels with Correos international tracked shipping and usually arrives in 5 to 8 business days. It will be delivered to your door, no signature needed.\n\n' +
      "When it arrives, tell us how it goes. Just reply to this email.\n\n" +
      `Thanks,\n${SIGNATURE}\n`,
  };
}
