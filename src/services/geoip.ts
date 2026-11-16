import fs from 'fs';
import os from 'os';
import path from 'path';
import { isIP } from 'net';

/**
 * País (ISO-2 en mayúsculas) de una IP con geoip-lite: base de datos local
 * de MaxMind GeoLite incluida en el paquete, sin llamadas a fuera. Solo se
 * usa para guardar el país del visitante; la IP no se guarda en ningún sitio.
 *
 * Memoria: geoip-lite carga sus ficheros enteros en RAM. Si encuentra los de
 * ciudad (los trae el paquete, ~145 MB) se va a ~150 MB de RSS; con solo los
 * de país, ~17 MB. Como solo queremos el país, la primera vez se copian los
 * dos ficheros de país (~14 MB) a una carpeta temporal y se le dice a
 * geoip-lite que lea de ahí (global.geodatadir). Se carga la primera vez que
 * hace falta, no al arrancar el API. Si algo falla devuelve null: el país
 * nunca puede romper el alta de un lead.
 */

type GeoLite = { lookup(ip: string): { country?: string } | null };
let geo: GeoLite | null | undefined;

const COUNTRY_FILES = ['geoip-country.dat', 'geoip-country6.dat'];

/** Carpeta con solo los ficheros de país; null si no se pudo preparar. */
function countryOnlyDir(): string | null {
  try {
    const src = path.join(path.dirname(require.resolve('geoip-lite/package.json')), 'data');
    const dir = path.join(os.tmpdir(), 'frame-geoip-country');
    fs.mkdirSync(dir, { recursive: true });
    for (const f of COUNTRY_FILES) {
      const from = path.join(src, f);
      const to = path.join(dir, f);
      const size = fs.statSync(from).size;
      if (!fs.existsSync(to) || fs.statSync(to).size !== size) fs.copyFileSync(from, to);
    }
    return dir;
  } catch (err) {
    console.error('[geoip] no se pudo preparar la carpeta solo-país; se carga la base completa', err);
    return null;
  }
}

function load(): GeoLite | null {
  if (geo !== undefined) return geo;
  try {
    const dir = countryOnlyDir();
    if (dir) (global as unknown as { geodatadir?: string }).geodatadir = dir;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    geo = require('geoip-lite') as GeoLite;
  } catch (err) {
    console.error('[geoip] no se pudo cargar geoip-lite', err);
    geo = null;
  }
  return geo;
}

/** Quita el puerto, los corchetes de IPv6 y el prefijo ::ffff: de IPv4 mapeada. */
function cleanIp(raw: string): string | null {
  let ip = raw.trim();
  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    ip = end > 0 ? ip.slice(1, end) : ip.slice(1);
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }
  if (ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

export function countryFromIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = cleanIp(raw);
  if (!ip) return null;
  try {
    const c = load()?.lookup(ip)?.country;
    return c && /^[A-Z]{2}$/i.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}
