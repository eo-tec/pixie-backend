import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const addToWaitlist = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const trimmed = email.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await prisma.waitlist.create({
      data: { email: trimmed },
    });

    return res.status(201).json({ message: 'Added to waitlist' });
  } catch (error: any) {
    // Handle unique constraint violation (duplicate email)
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'Email already on the waitlist' });
    }
    console.error('Waitlist error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
