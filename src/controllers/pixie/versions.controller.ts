// src/controllers/versions.controller.ts
import { Request, Response } from 'express';
import prisma from '../../services/prisma';
import { getPresignedUrlBin } from '../../minio/minio';


export async function getLatestVersion(req: Request, res: Response) {
  try {
    const version = await prisma.code_versions.findFirst({
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!version) {
      res.status(404).send('Versión no encontrada.');
      return;
    }

    const url = await getPresignedUrlBin(version.url);


    res.json({
      ...version,
      url,
    });
  } catch (err) {
    console.error('/get-latest-version error:', err);
    res.status(500).send('Error al procesar la solicitud.');
  }
}
