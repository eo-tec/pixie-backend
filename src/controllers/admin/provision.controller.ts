import { Request, Response } from 'express';
import prisma from '../../services/prisma';
import { linkUnitToMac } from '../../services/crm.service';

/**
 * CRM: en QC, si la herramienta de provisión manda el número de serie de la
 * etiqueta (`sn`, p. ej. FR-0007), la unidad queda enlazada a esta MAC y a su
 * pixie. Si falla no rompe la provisión: devuelve el error en `unit`.
 */
async function linkSn(sn: unknown, mac: string, pixieId: number) {
  if (typeof sn !== 'string' || !sn.trim()) return undefined;
  try {
    const unit = await linkUnitToMac(sn.trim().toUpperCase(), mac, pixieId);
    return { sn: unit.sn, linked: true };
  } catch (err) {
    return { sn, linked: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export async function provisionFrame(req: Request, res: Response) {
  try {
    const { mac } = req.body;

    if (!mac || !MAC_REGEX.test(mac)) {
      res.status(400).json({ error: 'Invalid MAC format. Expected AA:BB:CC:DD:EE:FF' });
      return;
    }

    const normalizedMac = mac.toUpperCase();

    // Check if pixie already exists
    const existing = await prisma.pixie.findFirst({
      where: { mac: normalizedMac },
    });

    if (existing) {
      // Upgrade to premium if needed
      if (existing.tier !== 'premium') {
        await prisma.pixie.update({
          where: { id: existing.id },
          data: { tier: 'premium' },
        });
        console.log(`[admin:provision] Upgraded frame ${existing.id} to premium`);
      }
      console.log(`[admin:provision] Existing frame ${existing.id} for MAC ${normalizedMac}`);
      const unit = await linkSn(req.body?.sn, normalizedMac, existing.id);
      res.status(200).json({ frameId: existing.id, existing: true, unit });
      return;
    }

    // Create new pixie as premium (same pattern as handleRegisterRequest)
    const pixie = await prisma.pixie.create({
      data: {
        mac: normalizedMac,
        name: 'frame.',
        code: '0000',
        pictures_on_queue: 1,
        tier: 'premium',
      },
    });

    // Create default playlist item
    await prisma.playlist_items.create({
      data: {
        pixie_id: pixie.id,
        position: 0,
        face_type: 'photos',
        locked: true,
      },
    });

    console.log(`[admin:provision] Created premium frame ${pixie.id} for MAC ${normalizedMac}`);
    const unit = await linkSn(req.body?.sn, normalizedMac, pixie.id);
    res.status(201).json({ frameId: pixie.id, existing: false, unit });
  } catch (err) {
    console.error('[admin:provision] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
