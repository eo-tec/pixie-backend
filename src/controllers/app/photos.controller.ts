import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import sharp from "sharp";
import { uploadFile } from "../../minio/minio";
import { publishToMQTT } from "../../mqtt/client";
import { sanitizeFilename } from "../../utils/string-utils";
const prisma = new PrismaClient();

async function photoToPixelMatrix(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error(
      "Error: No se pudieron obtener las dimensiones de la imagen."
    );
  }
  const size = Math.min(metadata.width, metadata.height);
  const left = Math.floor((metadata.width - size) / 2);
  const top = Math.floor((metadata.height - size) / 2);
  const resizedBuffer = await sharp(buffer)
    .extract({ left, top, width: size, height: size })
    .resize(64, 64)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const pixelData = [];
  for (let y = 0; y < 64; y++) {
    const row = [];
    for (let x = 0; x < 64; x++) {
      const idx = (y * 64 + x) * 4;
      let r = resizedBuffer[idx];
      let g = resizedBuffer[idx + 1];
      let b = resizedBuffer[idx + 2];
      const a = resizedBuffer[idx + 3];

      // If the pixel is transparent, set it to white
      if (a === 0) {
        r = 255;
        g = 255;
        b = 255;
      }

      // Convert to RGB565: 5 bits red, 6 bits green, and 5 bits blue
      const rgb565 =
        ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
      row.push(rgb565);
    }
    pixelData.push(row);
  }
  return pixelData;
}

export async function getPhotosFromUser(
  req: AuthenticatedRequest,
  res: Response
) {
  const id = req.user?.id;

  if (!id) {
    res.status(401).send("Error: usuario no autenticado.");
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const skip = (page - 1) * pageSize;

  try {
    const photos = await prisma.photos.findMany({
      skip: skip,
      take: pageSize,
      distinct: ["photo_url"],
      where: {
        deleted_at: null,
        OR: [
          {
            visible_by: {
              some: {
                user_id: id,
              },
            },
          },
          {
            user_id: id,
          },
        ],
      },
      select: {
        id: true,
        created_at: true,
        photo_url: true,
        username: true,
        title: true,
        user_id: true,
        users: true,
        photo_groups: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const totalPhotos = await prisma.photos.count({
      where: {
        deleted_at: null,
        OR: [
          {
            visible_by: {
              some: {
                user_id: id,
              },
            },
          },
          {
            user_id: id,
          },
        ],
      },
    });

    if (!photos) {
      console.error("Error al obtener las fotos");
      res.status(500).send("Error al obtener las fotos.");
      return;
    }

    res.status(200).json({
      photos,
      totalPhotos,
      totalPages: Math.ceil(totalPhotos / pageSize),
      currentPage: page,
    });
  } catch (err) {
    console.error("/photo error:", err);
    res.status(500).send("Error al obtener la foto.");
  }
}

export async function imageToRGB565(buffer: Buffer) {
  const RAW = await sharp(buffer).resize(64, 64).raw().toBuffer(); // RGB888
  const out = Buffer.alloc(64 * 64 * 2); // 8 192 B
  for (let i = 0, j = 0; i < RAW.length; i += 3, j += 2) {
    const r = RAW[i] >> 3,
      g = RAW[i + 1] >> 2,
      b = RAW[i + 2] >> 3;
    out[j] = (r << 3) | (g >> 3);
    out[j + 1] = ((g & 7) << 5) | b;
  }
  return out;
}

export async function postPhoto(req: Request, res: Response) {
  try {
    const { userId, title, photoFile, usersId } = req.body;

    if (!userId || !photoFile) {
      res.status(400).send("Error: datos incompletos.");
      return;
    }

    // 📌 Verificar si el usuario existe
    const user = await prisma.public_users.findFirst({
      where: { user_id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      res.status(404).send("❌ Error: usuario no encontrado.");
      return;
    }


    // 📌 Convertir la imagen de Base64 a Buffer
    const fileBuffer = Buffer.from(photoFile, "base64");

    const processedImage = await sharp(fileBuffer)
      .rotate() // 🔥 Corrige la rotación automáticamente según EXIF
      .resize(300, 300) // Opcional: redimensionar
      .png({ quality: 90 })
      .toBuffer();

    // 📌 Subir la imagen a Minio
    const sanitizedUsername = sanitizeFilename(user.username);
    const sanitizedTitle = sanitizeFilename(title);
    const fileNameMinio = `${sanitizedUsername}/${Date.now()}_${sanitizedTitle}.png`;
    const photoUrlMinio = await uploadFile(
      processedImage,
      fileNameMinio,
      "image/png"
    );



    // 📌 Guardar en la base de datos
    const newPhoto = await prisma.photos.create({
      data: {
        user_id: user.id,
        title: title,
        photo_url: fileNameMinio,
        username: user.username,
        created_at: new Date(),
        photo_pixels: await photoToPixelMatrix(processedImage),
      },
      include: {
        users: true,
      },
    });

    const pixies = await prisma.pixie.findMany({
      where: {
        created_by: user.id,
      },
    });

    for (const pixie of pixies) {
      await publishToMQTT(
        `pixie/${pixie.id}`,
        JSON.stringify({
          action: "update_photo",
          id: newPhoto.id,
        })
      );
    }

    // Añadir registros en photo_visible_by_users para cada usuario
    if (usersId && Array.isArray(usersId)) {
      for (const visibleUserId of usersId) {
        await prisma.photo_visible_by_users.create({
          data: {
            photo_id: newPhoto.id,
            user_id: Number(visibleUserId),
            created_at: new Date(),
          },
        });

      }
    }

    // Publicar en el topic pixie/visibleUserId por cada usuario visible
    if (usersId && Array.isArray(usersId)) {
      for (const visibleUserId of usersId) {
      }
    }

    res.status(201).json(newPhoto);
  } catch (err) {
    console.error("❌ /post-photo error:", err);
    res.status(500).send("Error al subir la foto.");
  }
}

export async function deletePhoto(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!id) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  try {
    const photo = await prisma.photos.findFirst({
      where: {
        id: parseInt(id),
        user_id: userId,
      },
    });

    if (!photo) {
      res.status(404).json({ error: "Foto no encontrada o no tienes permisos" });
      return;
    }

    const updatedPhoto = await prisma.photos.update({
      where: { id: parseInt(id) },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({ message: "Foto eliminada", photo: updatedPhoto });
  } catch (error) {
    console.error("Error al eliminar la foto:", error);
    res.status(500).json({ error: "Error al eliminar la foto" });
  }
}

export async function getPhotoVisibility(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!id) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  try {
    // Verificar que la foto existe y pertenece al usuario
    const photo = await prisma.photos.findFirst({
      where: {
        id: parseInt(id),
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!photo) {
      res.status(404).json({ error: "Foto no encontrada o no tienes permisos" });
      return;
    }

    // Obtener usuarios que pueden ver la foto
    const visibleUsers = await prisma.photo_visible_by_users.findMany({
      where: {
        photo_id: parseInt(id),
      },
      select: {
        user_id: true,
      },
    });

    const userIds = visibleUsers.map(vu => vu.user_id);

    res.status(200).json({ userIds });
  } catch (error) {
    console.error("Error al obtener visibilidad de la foto:", error);
    res.status(500).json({ error: "Error al obtener visibilidad de la foto" });
  }
}

export async function updatePhotoVisibility(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { userIds } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!id) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  if (!Array.isArray(userIds)) {
    res.status(400).json({ error: "userIds debe ser un array" });
    return;
  }

  try {
    // Verificar que la foto existe y pertenece al usuario
    const photo = await prisma.photos.findFirst({
      where: {
        id: parseInt(id),
        user_id: userId,
        deleted_at: null,
      },
    });

    if (!photo) {
      res.status(404).json({ error: "Foto no encontrada o no tienes permisos" });
      return;
    }

    // Usar transacción para garantizar consistencia
    await prisma.$transaction(async (tx) => {
      // Eliminar todas las visibilidades existentes
      await tx.photo_visible_by_users.deleteMany({
        where: {
          photo_id: parseInt(id),
        },
      });

      // Crear nuevas visibilidades
      if (userIds.length > 0) {
        const visibilityData = userIds.map((visibleUserId: number) => ({
          photo_id: parseInt(id),
          user_id: Number(visibleUserId),
          created_at: new Date(),
        }));

        await tx.photo_visible_by_users.createMany({
          data: visibilityData,
        });
      }
    });

    res.status(200).json({ message: "Visibilidad actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar visibilidad de la foto:", error);
    res.status(500).json({ error: "Error al actualizar visibilidad de la foto" });
  }
}
