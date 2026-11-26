// Zona horaria de los frames.
//
// El firmware solo entiende un desfase fijo en minutos (timezone_offset) y no
// sabe nada del horario de verano. Por eso guardamos la zona IANA del usuario
// ("Europe/Madrid") y es el backend quien calcula el desfase de cada momento y
// se lo vuelve a mandar al frame cuando cambia (ver services/timezone-sync.ts).

/** true si el runtime reconoce la zona IANA. */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Desfase respecto a UTC en minutos de la zona `tz` en el instante `at`. */
export function offsetMinutesFor(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const atSeconds = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtc - atSeconds) / 60000);
}

type TimezoneFields = {
  timezone?: string | null;
  timezone_manual?: boolean | null;
  timezone_offset?: number | null;
} | null | undefined;

/**
 * Desfase que hay que mandar a los frames de este usuario ahora mismo.
 * Con zona IANA (y sin desfase manual) se calcula al vuelo, así es correcto
 * aunque el job horario aún no haya actualizado timezone_offset en la BD.
 */
export function ownerTimezoneOffset(user: TimezoneFields): number {
  if (user?.timezone && !user.timezone_manual && isValidTimezone(user.timezone)) {
    return offsetMinutesFor(user.timezone);
  }
  return user?.timezone_offset ?? 0;
}
