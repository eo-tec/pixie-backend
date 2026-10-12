import { Request, Response, NextFunction } from 'express';
import { ADMIN_API_KEY, DASHBOARD_KEY } from '../config';

export const verifyAdminKey = (req: Request, res: Response, next: NextFunction): void => {
  if (!ADMIN_API_KEY) {
    res.status(500).json({ error: 'ADMIN_API_KEY not configured on server' });
    return;
  }

  const key = req.headers['x-admin-key'] as string;
  if (!key || key !== ADMIN_API_KEY) {
    res.status(401).json({ error: 'Invalid or missing admin key' });
    return;
  }

  next();
};

// La clave del dashboard es corta, así que se limitan los fallos por IP para
// que no se pueda adivinar a fuerza de intentos.
const MAX_FAILS = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; since: number }>();

// Traefik añade la IP real al final de X-Forwarded-For; las de delante las
// puede inventar el cliente.
const clientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string | undefined)?.split(',').pop()?.trim() || req.ip || 'unknown';

/** Solo lectura del dashboard: acepta la clave de admin o la del dashboard. */
export const verifyDashboardKey = (req: Request, res: Response, next: NextFunction): void => {
  const ip = clientIp(req);
  const now = Date.now();
  const entry = fails.get(ip);
  if (entry && now - entry.since > FAIL_WINDOW_MS) fails.delete(ip);
  if ((fails.get(ip)?.count ?? 0) >= MAX_FAILS) {
    res.status(429).json({ error: 'Too many attempts, try again later' });
    return;
  }

  const key = req.headers['x-admin-key'] as string;
  const ok = !!key && ((!!ADMIN_API_KEY && key === ADMIN_API_KEY) || (!!DASHBOARD_KEY && key === DASHBOARD_KEY));
  if (!ok) {
    const current = fails.get(ip);
    fails.set(ip, { count: (current?.count ?? 0) + 1, since: current?.since ?? now });
    res.status(401).json({ error: 'Invalid or missing admin key' });
    return;
  }

  fails.delete(ip);
  next();
};
