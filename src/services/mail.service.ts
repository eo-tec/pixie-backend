import nodemailer, { Transporter } from 'nodemailer';

// Envío de emails por SMTP (Hostinger, SSL en el 465), desde el buzón que diga
// SMTP_USER (noreply@getframe64.com desde el 12 nov 2026).
// Todo sale de variables de entorno; sin SMTP_HOST/SMTP_USER/SMTP_PASS no se
// envía nada. Con MAIL_DRY_RUN=1 el email se escribe en el log y no sale.
// Cada email lleva copia oculta a MAIL_BCC (hello@ por defecto) para que quede
// registro en el buzón, ya que por SMTP no se guarda en Enviados.
// Las respuestas del cliente van a MAIL_REPLY_TO (hello@getframe64.com por
// defecto), porque el remitente es un noreply.

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `Álvaro from Frame <${SMTP_USER}>` : '');
const MAIL_BCC = process.env.MAIL_BCC ?? 'hello@frame64.fun';
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO ?? 'hello@getframe64.com';
const DRY_RUN = process.env.MAIL_DRY_RUN === '1' || process.env.MAIL_DRY_RUN === 'true';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }
}

export function mailConfigured(): boolean {
  return DRY_RUN || (!!SMTP_HOST && !!SMTP_USER && !!SMTP_PASS);
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (DRY_RUN) {
    console.log(`[mail] DRY RUN to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  if (!mailConfigured()) throw new MailNotConfiguredError();
  await getTransport().sendMail({
    from: MAIL_FROM,
    to: mail.to,
    bcc: MAIL_BCC || undefined,
    replyTo: MAIL_REPLY_TO || undefined,
    subject: mail.subject,
    text: mail.text,
  });
}
