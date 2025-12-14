import prisma from '../src/services/prisma';
import { uploadFile } from '../src/minio/minio';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface Profile {
  username: string;
  photo: string;
}

const profiles: Profile[] = [
  { username: "John", photo: "perros.png" },
  { username: "Manu", photo: "golf.png" },
  { username: "Mum", photo: "paella.png" },
  { username: "Me", photo: "fiesta.png" },
  { username: "", photo: "frameAllBlack.png" },
];

const MAIN_USER_ID = 1;

async function createFriendship(userId: number) {
  // Verificar si ya existe la amistad
  const existingFriendship = await prisma.friends.findFirst({
    where: {
      OR: [
        { user_id_1: MAIN_USER_ID, user_id_2: userId },
        { user_id_1: userId, user_id_2: MAIN_USER_ID },
      ]
    }
  });

  if (existingFriendship) {
    console.log(`👥 Amistad ya existe con usuario ${userId}`);
    return;
  }

  await prisma.friends.create({
    data: {
      user_id_1: MAIN_USER_ID,
      user_id_2: userId,
      status: 'accepted',
    }
  });
  console.log(`🤝 Amistad creada con usuario ${userId}`);
}

async function main() {
  console.log("🚀 Iniciando seed de perfiles...\n");

  for (const profile of profiles) {
    // 1. Verificar si el usuario ya existe
    const existingUser = await prisma.public_users.findFirst({
      where: { username: profile.username }
    });

    if (existingUser) {
      console.log(`⏭️  Usuario "${profile.username}" ya existe (id: ${existingUser.id})`);
      await createFriendship(existingUser.id);
      console.log('');
      continue;
    }

    // 2. Crear usuario
    const user = await prisma.public_users.create({
      data: {
        username: profile.username,
        user_id: uuidv4(),
      }
    });
    console.log(`✅ Usuario "${user.username}" creado (id: ${user.id})`);

    // 3. Leer y procesar imagen
    const imagePath = path.join(__dirname, '..', profile.photo);

    if (!fs.existsSync(imagePath)) {
      console.error(`❌ No se encontró la imagen: ${imagePath}`);
      continue;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const processedImage = await sharp(imageBuffer)
      .rotate()
      .resize(300, 300)
      .png({ quality: 90 })
      .toBuffer();

    // 4. Subir a MinIO
    const fileName = `${profile.username}/${Date.now()}_${profile.photo}`;
    await uploadFile(processedImage, fileName, 'image/png');
    console.log(`📤 Imagen subida: ${fileName}`);

    // 5. Crear registro de foto pública
    const photo = await prisma.photos.create({
      data: {
        user_id: user.id,
        username: user.username,
        title: profile.photo.replace('.png', ''),
        photo_url: fileName,
        is_public: true,
        photo_pixels: {},
      }
    });
    console.log(`🖼️  Foto pública creada (id: ${photo.id})`);

    // 6. Crear amistad con usuario principal
    await createFriendship(user.id);
    console.log('');
  }

  console.log("✨ Seed completado!");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
