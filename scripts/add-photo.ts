import prisma from '../src/services/prisma';
import { uploadFile } from '../src/minio/minio';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function main() {
  const imageBuffer = fs.readFileSync(path.join(__dirname, '..', 'frameAllWhite.png'));
  const processedImage = await sharp(imageBuffer)
    .rotate()
    .resize(300, 300)
    .png({ quality: 90 })
    .toBuffer();

  const fileName = `/${Date.now()}_frameAllWhite.png`;
  await uploadFile(processedImage, fileName, 'image/png');
  console.log('📤 Imagen subida:', fileName);

  const photo = await prisma.photos.create({
    data: {
      user_id: 18,
      username: '',
      title: '',
      photo_url: fileName,
      is_public: true,
      photo_pixels: {},
    }
  });
  console.log('🖼️  Foto pública creada (id:', photo.id, ')');
}

main().catch(console.error).finally(() => prisma.$disconnect());
