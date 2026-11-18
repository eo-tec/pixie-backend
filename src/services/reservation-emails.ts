import { Mail } from './mail.service';
import { formatAmount, Locale } from './beta-order-emails';

// «Ticket» de la reserva «Frame64 · Founders spot» (1 €, 100 plazas,
// reembolsable hasta el lanzamiento, decidido el 17 nov 2026): Frame a 75 € en
// Kickstarter, que abre el 1 feb 2027; el enlace llega el 31 ene.
// Texto plano, mismo estilo que los emails de las betas: sin guiones, «we»
// para la empresa, «I» solo para lo personal, en castellano «Hola,».

/** Importe de la reserva Founders spot (1 € o 1 $), en céntimos. */
export const FOUNDERS_SPOT_CENTS = 100;
/** Plazas Founder a la venta. */
export const FOUNDERS_SPOTS = 100;

export interface ReservationForEmail {
  email: string;
  /** Idioma del lead: 'es' en castellano, cualquier otro en inglés. */
  lang?: string | null;
  /** Posición entre las reservas Founder activas, por orden de reserva. */
  spot: number;
  reserved_at: Date;
  amount_cents: number;
  currency: string;
  /** ID de pago de Stripe (o la sesión si no hay pago). */
  reference: string;
}

export function localeForLang(lang?: string | null): Locale {
  return lang?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

const SIGNATURE = 'Álvaro\nFrame';

export function reservationTicketEmail(r: ReservationForEmail): Mail {
  const locale = localeForLang(r.lang);
  const amount = formatAmount(r.amount_cents, r.currency, locale);
  const date = formatDate(r.reserved_at, locale);
  const ofTotal = r.spot <= FOUNDERS_SPOTS;

  if (locale === 'es') {
    return {
      to: r.email,
      subject: `Tu plaza Founder #${r.spot} está confirmada`,
      text:
        'Hola,\n\n' +
        'Gracias por reservar tu plaza Founder de Frame. Ya está confirmada, y que confíes en Frame antes de la campaña significa mucho para mí.\n\n' +
        `Plaza Founder: #${r.spot}${ofTotal ? ` de ${FOUNDERS_SPOTS}` : ''}\n` +
        `Fecha: ${date}\n` +
        `Importe: ${amount}\n` +
        `Referencia de pago: ${r.reference}\n\n` +
        'Con tu plaza te llevas Frame a 75 € en Kickstarter. La campaña abre el 1 de febrero de 2027 y el 31 de enero te mandaremos tu enlace para conseguirlo a ese precio.\n\n' +
        'La reserva es reembolsable hasta el lanzamiento. Si cambias de idea, responde a este email y te devolvemos el importe.\n\n' +
        `Un abrazo,\n${SIGNATURE}\n`,
    };
  }

  return {
    to: r.email,
    subject: `Your Founders spot #${r.spot} is confirmed`,
    text:
      'Hi,\n\n' +
      "Thank you for reserving a Founders spot for Frame. It's confirmed, and the fact that you trust Frame before the campaign even starts means a lot to me.\n\n" +
      `Founders spot: #${r.spot}${ofTotal ? ` of ${FOUNDERS_SPOTS}` : ''}\n` +
      `Date: ${date}\n` +
      `Amount: ${amount}\n` +
      `Payment reference: ${r.reference}\n\n` +
      "Your spot gets you Frame for €75 on Kickstarter. The campaign opens on February 1, 2027, and on January 31 we'll send you your link to get it at that price.\n\n" +
      "Your reservation is refundable until launch. If you change your mind, just reply to this email and we'll refund it.\n\n" +
      `Thanks,\n${SIGNATURE}\n`,
  };
}
