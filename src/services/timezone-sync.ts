// Cambio de hora de verano en los frames.
//
// Cada hora recalcula el desfase de los usuarios con zona IANA. Si ha cambiado
// (último domingo de marzo/octubre en Europa, etc.), lo guarda y se lo manda a
// sus frames con un update_info parcial: el firmware solo toca los campos que
// vienen en el mensaje, así que no pisa brillo, horario ni nada más.
import prisma from './prisma';
import { publishToMQTT } from '../mqtt/client';
import { isValidTimezone, offsetMinutesFor } from '../utils/timezone';

/** Manda el desfase a todos los frames de un usuario. */
export async function pushTimezoneToUserFrames(userId: number, offset: number): Promise<number> {
  const frames = await prisma.pixie.findMany({
    where: { created_by: userId },
    select: { id: true },
  });
  for (const f of frames) {
    publishToMQTT(`frame/${f.id}`, JSON.stringify({ action: 'update_info', timezone_offset: offset }));
  }
  return frames.length;
}

export async function syncTimezoneOffsets(): Promise<void> {
  try {
    const users = await prisma.public_users.findMany({
      where: { timezone: { not: null }, timezone_manual: false },
      select: { id: true, timezone: true, timezone_offset: true },
    });
    for (const u of users) {
      if (!isValidTimezone(u.timezone)) continue;
      const offset = offsetMinutesFor(u.timezone);
      if (offset === u.timezone_offset) continue;
      await prisma.public_users.update({ where: { id: u.id }, data: { timezone_offset: offset } });
      const n = await pushTimezoneToUserFrames(u.id, offset);
      console.log(`[TZ] Usuario ${u.id} (${u.timezone}): ${u.timezone_offset} -> ${offset} min, enviado a ${n} frame(s)`);
    }
  } catch (err) {
    console.error('[TZ] Error sincronizando zonas horarias:', err);
  }
}

export function startTimezoneSync(): void {
  setInterval(syncTimezoneOffsets, 3600 * 1000).unref();
  setTimeout(syncTimezoneOffsets, 90_000).unref(); // primera pasada tras arrancar (MQTT ya conectado)
}
