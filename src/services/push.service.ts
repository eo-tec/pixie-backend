import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from './prisma';
import {
  NotificationCategory,
  NotificationKey,
  renderCopy,
} from './notification-copy';

const expo = new Expo();

/** Payload para el deep link. La app aun no lo consume (Fase 3), pero se envia
 *  desde ya para no tener que tocar cada punto de envio despues. */
export interface PushData {
  type: 'photo' | 'friend_request' | 'profile' | 'frame' | 'reminder';
  entityId?: number;
}

interface SendOptions {
  key: NotificationKey;
  category: NotificationCategory;
  /** Se interpolan en el copy; `actor` es el nombre de quien dispara el evento. */
  params: Record<string, string>;
  data?: PushData;
}

interface PrefsShape {
  [category: string]: boolean;
}

/**
 * Envia una notificacion a un usuario, en su idioma y respetando sus
 * preferencias.
 *
 * Silencioso a proposito: un fallo enviando nunca debe tumbar la operacion que
 * lo origino (subir una foto, aceptar una amistad). Todos los errores se
 * loguean y se tragan.
 */
export async function sendToUser(
  userId: number,
  options: SendOptions
): Promise<void> {
  try {
    const user = await prisma.public_users.findUnique({
      where: { id: userId },
      select: {
        language: true,
        notification_prefs: true,
        push_tokens: { select: { token: true } },
      },
    });

    if (!user || user.push_tokens.length === 0) return;

    // Ausencia de preferencia = activada. Si en el futuro se anade una
    // categoria nueva, los usuarios existentes la reciben sin necesidad de
    // rellenar su jsonb.
    const prefs = (user.notification_prefs ?? {}) as PrefsShape;
    if (prefs[options.category] === false) return;

    const { title, body } = renderCopy(options.key, user.language, options.params);

    const messages: ExpoPushMessage[] = user.push_tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        title,
        body,
        sound: 'default' as const,
        data: options.data ? { ...options.data } : undefined,
      }));

    if (messages.length === 0) return;

    const tickets: ExpoPushTicket[] = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
      } catch (error) {
        console.error('Error enviando chunk de notificaciones:', error);
      }
    }

    await handleImmediateErrors(tickets, messages);
  } catch (error) {
    console.error('Error en sendToUser:', error);
  }
}

/**
 * Limpia los tokens que Expo rechaza en el acto.
 *
 * `DeviceNotRegistered` significa que la app se desinstalo o el token roto:
 * conservarlo solo genera errores en cada envio posterior.
 */
async function handleImmediateErrors(
  tickets: ExpoPushTicket[],
  messages: ExpoPushMessage[]
): Promise<void> {
  const deadTokens: string[] = [];

  tickets.forEach((ticket, i) => {
    if (ticket.status !== 'error') return;

    const message = messages[i];
    console.error('Ticket de push con error:', ticket.message);

    if (ticket.details?.error === 'DeviceNotRegistered' && message) {
      const to = Array.isArray(message.to) ? message.to[0] : message.to;
      if (to) deadTokens.push(to);
    }
  });

  if (deadTokens.length === 0) return;

  try {
    await prisma.push_tokens.deleteMany({ where: { token: { in: deadTokens } } });
    console.log(`Eliminados ${deadTokens.length} push tokens muertos`);
  } catch (error) {
    console.error('Error limpiando push tokens:', error);
  }
}

/**
 * Version para varios destinatarios del mismo evento (p. ej. los amigos que
 * reciben una foto). Cada uno recibe el copy en su idioma, asi que no se puede
 * reutilizar un unico mensaje.
 */
export async function sendToUsers(
  userIds: number[],
  options: SendOptions
): Promise<void> {
  await Promise.all(userIds.map((id) => sendToUser(id, options)));
}
