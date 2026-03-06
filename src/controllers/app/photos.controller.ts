import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { uploadFile } from "../../minio/minio";
import { publishToMQTT } from "../../mqtt/client";
import { sanitizeFilename } from "../../utils/string-utils";
const prisma = new PrismaClient();

const MAX_ANIMATION_FRAMES = 20;
const ANIMATION_FPS = 5;
const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 64;
const FRAME_SIZE_RGB565 = FRAME_WIDTH * FRAME_HEIGHT * 2; // 8192 bytes

/**
 * Extract frames from an animated GIF, resize to 64x64, convert to RGB565 binary.
 * Returns { bin: Buffer (all frames concatenated), frameCount: number, firstFramePng: Buffer }
 */
async function extractAnimationFrames(gifBuffer: Buffer): Promise<{
  bin: Buffer;
  frameCount: number;
  firstFramePng: Buffer;
}> {
  const metadata = await sharp(gifBuffer, { animated: true }).metadata();
  const pageHeight = metadata.height!;
  const width = metadata.width!;
  const totalPages = metadata.pages || 1;
  const frameHeight = pageHeight / totalPages;
  const frameCount = Math.min(totalPages, MAX_ANIMATION_FRAMES);

  // Extract all frames as one tall raw RGBA image
  const rawBuffer = await sharp(gifBuffer, { animated: true, pages: frameCount })
    .resize(FRAME_WIDTH, FRAME_HEIGHT * frameCount)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const bin = Buffer.alloc(frameCount * FRAME_SIZE_RGB565);

  for (let f = 0; f < frameCount; f++) {
    for (let y = 0; y < FRAME_HEIGHT; y++) {
      for (let x = 0; x < FRAME_WIDTH; x++) {
        const srcIdx = ((f * FRAME_HEIGHT + y) * FRAME_WIDTH + x) * 4;
        let r = rawBuffer[srcIdx];
        let g = rawBuffer[srcIdx + 1];
        let b = rawBuffer[srcIdx + 2];
        const a = rawBuffer[srcIdx + 3];
        if (a === 0) { r = 255; g = 255; b = 255; }

        const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
        const dstIdx = f * FRAME_SIZE_RGB565 + (y * FRAME_WIDTH + x) * 2;
        bin[dstIdx] = (rgb565 >> 8) & 0xff;
        bin[dstIdx + 1] = rgb565 & 0xff;
      }
    }
  }

  // First frame as PNG for preview/photo_pixels
  const firstFramePng = await sharp(gifBuffer, { animated: false, pages: 1 })
    .resize(300, 300)
    .png({ quality: 90 })
    .toBuffer();

  return { bin, frameCount, firstFramePng };
}

/**
 * Extract frames from an MP4 video using ffmpeg, resize to 64x64, convert to RGB565 binary.
 */
async function extractVideoFrames(videoBuffer: Buffer): Promise<{
  bin: Buffer;
  frameCount: number;
  firstFramePng: Buffer;
}> {
  const tmpDir = await fs.mkdtemp(join(tmpdir(), "frame-video-"));
  const inputPath = join(tmpDir, "input.mp4");
  const outputPattern = join(tmpDir, "frame_%03d.png");

  try {
    await fs.writeFile(inputPath, videoBuffer);

    // Extract frames at 10fps, max 20 frames, resized to 64x64
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-vf", `fps=${ANIMATION_FPS},scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease,pad=${FRAME_WIDTH}:${FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2:white`,
          "-frames:v", String(MAX_ANIMATION_FRAMES),
        ])
        .output(outputPattern)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    // Read extracted frame files
    const files = (await fs.readdir(tmpDir))
      .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
      .sort();

    const frameCount = files.length;
    if (frameCount === 0) throw new Error("No frames extracted from video");

    const bin = Buffer.alloc(frameCount * FRAME_SIZE_RGB565);

    for (let f = 0; f < frameCount; f++) {
      const framePath = join(tmpDir, files[f]);
      const rawBuffer = await sharp(framePath)
        .resize(FRAME_WIDTH, FRAME_HEIGHT)
        .ensureAlpha()
        .raw()
        .toBuffer();

      for (let y = 0; y < FRAME_HEIGHT; y++) {
        for (let x = 0; x < FRAME_WIDTH; x++) {
          const srcIdx = (y * FRAME_WIDTH + x) * 4;
          let r = rawBuffer[srcIdx];
          let g = rawBuffer[srcIdx + 1];
          let b = rawBuffer[srcIdx + 2];
          const a = rawBuffer[srcIdx + 3];
          if (a === 0) { r = 255; g = 255; b = 255; }

          const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
          const dstIdx = f * FRAME_SIZE_RGB565 + (y * FRAME_WIDTH + x) * 2;
          bin[dstIdx] = (rgb565 >> 8) & 0xff;
          bin[dstIdx + 1] = rgb565 & 0xff;
        }
      }
    }

    // First frame as PNG for preview
    const firstFramePng = await sharp(join(tmpDir, files[0]))
      .resize(300, 300)
      .png({ quality: 90 })
      .toBuffer();

    return { bin, frameCount, firstFramePng };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

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
    // Obtener IDs de amigos aceptados
    const friends = await prisma.friends.findMany({
      where: {
        status: 'accepted',
        OR: [
          { user_id_1: id },
          { user_id_2: id }
        ]
      }
    });
    const friendIds = friends.map(f => f.user_id_1 === id ? f.user_id_2 : f.user_id_1);

    // Query con fotos propias, compartidas conmigo, y públicas de amigos
    const whereClause = {
      deleted_at: null,
      OR: [
        { user_id: id },                                    // Mis fotos
        { visible_by: { some: { user_id: id } } },          // Compartidas conmigo
        ...(friendIds.length > 0 ? [{                       // Públicas de amigos
          is_public: true,
          user_id: { in: friendIds }
        }] : [])
      ],
    };

    const photos = await prisma.photos.findMany({
      skip: skip,
      take: pageSize,
      distinct: ["photo_url"],
      where: whereClause,
      select: {
        id: true,
        created_at: true,
        photo_url: true,
        username: true,
        title: true,
        user_id: true,
        is_public: true,
        users: true,
        photo_groups: true,
        _count: {
          select: {
            reactions: true,
            comments: { where: { deleted_at: null } },
          },
        },
        reactions: {
          where: { user_id: id },
          select: { type: true },
          take: 1,
        },
        comments: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 2,
          select: {
            id: true,
            content: true,
            created_at: true,
            user: {
              select: { id: true, username: true, picture: true },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const totalPhotos = await prisma.photos.count({
      where: whereClause,
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
    const { userId, title, photoFile, usersId, isPublic } = req.body;

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


    // Detect if it's a video from the base64 data URI prefix
    const isVideo = photoFile.startsWith('data:video/');

    // Convertir la imagen de Base64 a Buffer (eliminar prefijo data: si existe)
    const base64Data = photoFile.includes(',') ? photoFile.split(',')[1] : photoFile;
    const fileBuffer = Buffer.from(base64Data, "base64");

    // Detect if it's an animated GIF or video
    let isAnimation = isVideo;
    if (!isVideo) {
      const metadata = await sharp(fileBuffer, { animated: true }).metadata();
      isAnimation = (metadata.format === 'gif' && (metadata.pages || 1) > 1);
    }

    const sanitizedUsername = sanitizeFilename(user.username);
    const sanitizedTitle = sanitizeFilename(title);
    const timestamp = Date.now();

    let processedImage: Buffer;
    let fileNameMinio: string;
    let animationFrames: number | null = null;
    let animationFps: number | null = null;

    if (isAnimation) {
      const { bin, frameCount, firstFramePng } = isVideo
        ? await extractVideoFrames(fileBuffer)
        : await extractAnimationFrames(fileBuffer);
      processedImage = firstFramePng;

      // Upload the .bin with all frames to Minio
      const binFileName = `${sanitizedUsername}/${timestamp}_${sanitizedTitle}.bin`;
      await uploadFile(bin, binFileName, "application/octet-stream");

      // Upload first frame as PNG for preview
      fileNameMinio = `${sanitizedUsername}/${timestamp}_${sanitizedTitle}.png`;
      await uploadFile(processedImage, fileNameMinio, "image/png");

      animationFrames = frameCount;
      animationFps = ANIMATION_FPS;
      console.log(`[Upload] Animation processed: ${frameCount} frames, bin=${bin.length} bytes`);
    } else {
      processedImage = await sharp(fileBuffer)
        .rotate()
        .resize(300, 300)
        .png({ quality: 90 })
        .toBuffer();

      fileNameMinio = `${sanitizedUsername}/${timestamp}_${sanitizedTitle}.png`;
      await uploadFile(processedImage, fileNameMinio, "image/png");
    }

    // Guardar en la base de datos
    const newPhoto = await prisma.photos.create({
      data: {
        user_id: user.id,
        title: title,
        photo_url: fileNameMinio,
        username: user.username,
        created_at: new Date(),
        photo_pixels: await photoToPixelMatrix(processedImage),
        is_public: isPublic ?? false,
        is_animation: isAnimation,
        animation_frames: animationFrames,
        animation_fps: animationFps,
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
        `frame/${pixie.id}`,
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

    // Notificar frames de otros usuarios
    const notifyUserIds: number[] = [];

    if (isPublic) {
      // Foto pública: notificar a todos los amigos aceptados
      const friendships = await prisma.friends.findMany({
        where: {
          status: 'accepted',
          OR: [{ user_id_1: user.id }, { user_id_2: user.id }],
        },
      });
      for (const f of friendships) {
        const friendId = f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1;
        notifyUserIds.push(friendId);
      }
    } else if (usersId && Array.isArray(usersId)) {
      // Foto privada: notificar solo a los usuarios seleccionados
      notifyUserIds.push(...usersId.map(Number));
    }

    if (notifyUserIds.length > 0) {
      const sharedPixies = await prisma.pixie.findMany({
        where: { created_by: { in: notifyUserIds } },
      });
      for (const pixie of sharedPixies) {
        await publishToMQTT(
          `frame/${pixie.id}`,
          JSON.stringify({
            action: "update_photo",
            id: newPhoto.id,
          })
        );
      }
    }

    res.status(201).json(newPhoto);
  } catch (err) {
    console.error("❌ /post-photo error:", err);
    res.status(500).send("Error al subir la foto.");
  }
}

export async function deletePhoto(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string;
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
  const id = req.params.id as string;
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
  const id = req.params.id as string;
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
