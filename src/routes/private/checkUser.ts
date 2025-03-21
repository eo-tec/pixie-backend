import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config';
import prisma from '../../services/prisma';

// Definir tipo de usuario autenticado
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

interface SupabaseUser {
  id: string;
}

// Middleware de autenticación
export async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]; // Extraer el token del header
  console.log('🔐 Token:', token);

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return
  }

  try {
    // 🔥 Verificar el token en Supabase
    const { data: user, error } = await supabase.auth.getUser(token);
    
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return
    }

    // 🚀 Verificar si el usuario existe en la base de datos
    const userSupa = await prisma.public_users.findFirst({
      select: {
        id: true,
        username: true
      }
      ,where: {
        user_id: user.user?.id,
      }
    })

    if (!userSupa) {
      res.status(403).json({ error: 'User not found in database' });
      return
    }

    // ✅ Usuario autenticado y encontrado en la base de datos
    req.user = { id: userSupa?.id || 0, username: userSupa.username };
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

