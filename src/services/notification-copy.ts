/**
 * Textos de las notificaciones push, por idioma.
 *
 * Viven en el servidor porque una notificacion se muestra con la app cerrada:
 * la pinta el sistema operativo y ahi no corre JavaScript, asi que el cliente
 * no puede traducirla. El idioma de cada usuario se guarda en
 * `public_users.language` y lo sincroniza la app.
 */

export type NotificationCategory =
  | 'friend_photos'
  | 'friendships'
  | 'frame_activity'
  | 'reminders';

/** Cada key identifica un copy concreto; varias pueden compartir categoria. */
export type NotificationKey =
  | 'photo_shared'      // foto publica a todos los amigos
  | 'photo_sent_to_you' // foto compartida explicitamente contigo
  | 'friend_request'
  | 'friend_accepted'
  | 'drawing_started';

interface CopyEntry {
  title: (p: Record<string, string>) => string;
  body: (p: Record<string, string>) => string;
}

const COPY: Record<string, Record<NotificationKey, CopyEntry>> = {
  es: {
    photo_shared: {
      title: () => 'frame.',
      body: (p) => `${p.actor} ha compartido una foto`,
    },
    photo_sent_to_you: {
      title: () => 'frame.',
      body: (p) => `${p.actor} te ha enviado una foto`,
    },
    friend_request: {
      title: () => 'frame.',
      body: (p) => `${p.actor} quiere ser tu amigo`,
    },
    friend_accepted: {
      title: () => 'frame.',
      body: (p) => `${p.actor} ha aceptado tu solicitud`,
    },
    drawing_started: {
      title: () => 'frame.',
      body: (p) => `${p.actor} está dibujando en tu frame`,
    },
  },
  en: {
    photo_shared: {
      title: () => 'frame.',
      body: (p) => `${p.actor} shared a photo`,
    },
    photo_sent_to_you: {
      title: () => 'frame.',
      body: (p) => `${p.actor} sent you a photo`,
    },
    friend_request: {
      title: () => 'frame.',
      body: (p) => `${p.actor} wants to be your friend`,
    },
    friend_accepted: {
      title: () => 'frame.',
      body: (p) => `${p.actor} accepted your request`,
    },
    drawing_started: {
      title: () => 'frame.',
      body: (p) => `${p.actor} is drawing on your frame`,
    },
  },
};

const FALLBACK_LANGUAGE = 'en';

/**
 * Devuelve el copy ya renderizado. Acepta cualquier cosa en `language`
 * (incluido null o un `es-ES` con region) y cae a ingles si no la conoce.
 */
export function renderCopy(
  key: NotificationKey,
  language: string | null | undefined,
  params: Record<string, string>
): { title: string; body: string } {
  const base = (language ?? FALLBACK_LANGUAGE).split('-')[0].toLowerCase();
  const dict = COPY[base] ?? COPY[FALLBACK_LANGUAGE];
  const entry = dict[key];

  return { title: entry.title(params), body: entry.body(params) };
}
