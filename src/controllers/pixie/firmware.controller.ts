import { Request, Response } from 'express';
import prisma from '../../services/prisma';

const BUCKET_PUBLIC_URL = 'https://bucket.frame64.fun/versions';

export async function getFirmwareManifest(req: Request, res: Response) {
  try {
    const version = await prisma.code_versions.findFirst({
      orderBy: { created_at: 'desc' },
    });

    if (!version) {
      res.status(404).json({ error: 'No firmware version found' });
      return;
    }

    const manifest = {
      name: 'frame.',
      version: `v${version.version}`,
      builds: [
        {
          chipFamily: 'ESP32',
          parts: [
            { path: `${BUCKET_PUBLIC_URL}/bootloader.bin`, offset: 4096 },
            { path: `${BUCKET_PUBLIC_URL}/partitions.bin`, offset: 32768 },
            { path: `${BUCKET_PUBLIC_URL}/boot_app0.bin`, offset: 57344 },
            { path: `${BUCKET_PUBLIC_URL}/firmware_v${version.version}.bin`, offset: 65536 },
          ],
        },
      ],
    };

    res.json(manifest);
  } catch (err) {
    console.error('/firmware/manifest error:', err);
    res.status(500).json({ error: 'Error generating firmware manifest' });
  }
}
