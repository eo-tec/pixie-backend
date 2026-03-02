import { Request, Response, NextFunction } from 'express';
import { ADMIN_API_KEY } from '../config';

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
