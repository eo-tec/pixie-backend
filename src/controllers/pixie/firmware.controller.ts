import { Request, Response } from 'express';
import prisma from '../../services/prisma';

const BUCKET_PUBLIC_URL = 'https://bucket.frame64.fun/versions';

// ESP Web Tools elige el build cuyo chipFamily coincide con el chip detectado por USB.
// El bootloader del ESP32 clásico se flashea en 0x1000; el del ESP32-S3, en 0x0.
const HW_BUILDS = [
  { hw: 'v1', chipFamily: 'ESP32', bootloaderOffset: 0x1000 },
  { hw: 'v2', chipFamily: 'ESP32-S3', bootloaderOffset: 0x0 },
];

export async function getFirmwareManifest(req: Request, res: Response) {
  try {
    const builds: { chipFamily: string; parts: { path: string; offset: number }[] }[] = [];
    const versionLabels: string[] = [];

    for (const { hw, chipFamily, bootloaderOffset } of HW_BUILDS) {
      const version = await prisma.code_versions.findFirst({
        where: { hw_version: hw },
        orderBy: { version: 'desc' },
      });
      if (!version) continue;

      versionLabels.push(`${hw}: v${version.version}`);
      builds.push({
        chipFamily,
        parts: [
          { path: `${BUCKET_PUBLIC_URL}/${hw}/bootloader.bin`, offset: bootloaderOffset },
          { path: `${BUCKET_PUBLIC_URL}/${hw}/partitions.bin`, offset: 0x8000 },
          { path: `${BUCKET_PUBLIC_URL}/${hw}/boot_app0.bin`, offset: 0xe000 },
          { path: `${BUCKET_PUBLIC_URL}/${version.url}`, offset: 0x10000 },
        ],
      });
    }

    if (builds.length === 0) {
      res.status(404).json({ error: 'No firmware version found' });
      return;
    }

    res.json({
      name: 'frame.',
      version: versionLabels.join(' · '),
      builds,
    });
  } catch (err) {
    console.error('/firmware/manifest error:', err);
    res.status(500).json({ error: 'Error generating firmware manifest' });
  }
}
