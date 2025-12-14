/**
 * Release Helper Script
 * Auxiliar para el script de release de Spotipyx
 *
 * Comandos:
 *   get-version  - Obtiene la ultima version de la BD
 *   upload       - Sube firmware a MinIO y registra en BD
 */

import 'dotenv/config';
import prisma from '../src/services/prisma';
import minioClient from '../src/minio/minio';
import * as fs from 'fs';

const VERSIONS_BUCKET = 'versions';

async function getLatestVersion(): Promise<number> {
  const latest = await prisma.code_versions.findFirst({
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return latest?.version ?? 0;
}

async function ensureVersionsBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(VERSIONS_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(VERSIONS_BUCKET, 'euw');
    console.log(`Bucket '${VERSIONS_BUCKET}' creado`);
  }
}

async function uploadFirmware(
  filePath: string,
  filename: string,
  version: number,
  comments?: string
): Promise<void> {
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  // Asegurar que el bucket existe
  await ensureVersionsBucket();

  // Leer el archivo
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;

  // Subir a MinIO
  console.log(`Subiendo ${filename} a bucket '${VERSIONS_BUCKET}'...`);
  await minioClient.putObject(
    VERSIONS_BUCKET,
    filename,
    fileBuffer,
    fileSize,
    { 'Content-Type': 'application/octet-stream' }
  );
  console.log('Upload completado');

  // Registrar en base de datos
  console.log('Registrando version en base de datos...');
  await prisma.code_versions.create({
    data: {
      version: version,
      url: filename,
      comments: comments || null,
    },
  });
  console.log('Version registrada correctamente');
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'get-version': {
        const version = await getLatestVersion();
        console.log(version);
        break;
      }

      case 'upload': {
        const versionIdx = args.indexOf('--version');
        const fileIdx = args.indexOf('--file');
        const filenameIdx = args.indexOf('--filename');
        const commentsIdx = args.indexOf('--comments');

        if (versionIdx === -1 || fileIdx === -1 || filenameIdx === -1) {
          console.error('Uso: upload --version N --file PATH --filename NAME [--comments TEXT]');
          process.exit(1);
        }

        const v = parseInt(args[versionIdx + 1]);
        const file = args[fileIdx + 1];
        const filename = args[filenameIdx + 1];
        const comments = commentsIdx !== -1 ? args.slice(commentsIdx + 1).join(' ') : undefined;

        await uploadFirmware(file, filename, v, comments);
        break;
      }

      default:
        console.log('Release Helper - Comandos disponibles:');
        console.log('  get-version                    Obtiene la ultima version');
        console.log('  upload --version N --file PATH --filename NAME [--comments TEXT]');
        console.log('                                 Sube firmware y registra version');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
