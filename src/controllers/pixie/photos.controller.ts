// src/controllers/photos.controller.ts
import { Request, Response } from "express";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { checkFile, downloadFile, uploadFile } from "../../minio/minio";
import { publishToMQTT } from "../../mqtt/client";

const prisma = new PrismaClient();

export async function getPhoto(req: Request, res: Response) {
  const id = parseInt(String(req.query.id), 10);
  if (isNaN(id) || id < 0) {
    res.status(400).send('Error: parámetro "id" inválido.');
    return;
  }
  try {
    const pixieIdParam = Array.isArray(req.query.pixieId)
      ? req.query.pixieId[0]
      : req.query.pixieId;
    if (!pixieIdParam) {
      res.status(400).send('Error: parámetro "pixieId" inválido.');
      return;
    }
    const pixieId = parseInt(String(pixieIdParam), 10);
    if (isNaN(pixieId) || pixieId < 0) {
      res.status(400).send('Error: parámetro "pixieId" inválido.');
      return;
    }

    const pixie = await prisma.pixie.findUnique({
      where: {
        id: pixieId,
      },
    });

    if (!pixie || !pixie.created_by) {
      res
        .status(404)
        .send("Error: Pixie no encontrado o no tiene propietario.");
      return;
    }

    const photos = await prisma.photos.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                visible_by: {
                  some: {
                    user_id: pixie.created_by,
                  },
                },
              },
              {
                user_id: pixie.created_by,
              },
            ],
          },
          {
            deleted_at: null,
          },
        ],
      },
      orderBy: {
        created_at: "desc",
      },
      take: 10,
    });

    const photo = photos[id % photos.length];

    // Verificar si photo_pixels existe y tiene contenido
    if (
      photo.photo_pixels &&
      Array.isArray(photo.photo_pixels) &&
      photo.photo_pixels.length > 0
    ) {
      const cleanUsername = photo.username
        ? photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        : "";

      const clearTitle = photo.title
        ? photo.title
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\n/g, "")
        : "";

      res.json({
        photo: {
          width: 64,
          height: 64,
          data: photo.photo_pixels as number[][],
        },
        title: clearTitle,
        username: cleanUsername,
      });
      return;
    }

    console.log("Este es el url", photo?.photo_url);
    const fileName = photo?.photo_url?.split("/").pop() || "";
    const fileStream = await downloadFile(fileName);
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

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

    // Guardar los píxeles procesados en la base de datos
    await prisma.photos.update({
      where: { id: photo.id },
      data: { photo_pixels: pixelData },
    });

    const cleanUsername = photo.username
      ? photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : "";

    const clearTitle = photo.title
      ? photo.title
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\n/g, "")
      : "";

    res.json({
      photo: {
        width: 64,
        height: 64,
        data: pixelData,
      },
      title: clearTitle,
      username: cleanUsername,
    });
    return;
  } catch (err) {
    console.error("/get-photo error:", err);
    res.status(500).send("Error al procesar la solicitud.");
  }
}

async function getPhotoFromIndexId(index: number, id: number) {
  if (!isNaN(id) && id >= 0) {
    return await prisma.photos.findFirst({
      where: {
        id: id,
        deleted_at: null,
      },
    });
  } else {
    const photos = await prisma.photos.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: { created_at: "desc" },
      take: 5,
    });
    return photos[index % photos.length];
  }
}
export async function getPhotoBinary(req: Request, res: Response) {
  const id = Number(req.query.id);
  const index = Number(req.query.index);
  const photo = await getPhotoFromIndexId(index, id);
  console.log("photo", photo?.photo_url);
  if (!photo?.photo_url) {
    res.status(404).send("Foto no encontrada.");
    return;
  }
  try {
    const fileNameMinio = photo.photo_url;
    const fileNameMinioBin = fileNameMinio + ".bin";
    console.log("fileNameMinioBin", fileNameMinioBin);
    const fileExists = await checkFile(fileNameMinioBin);

    const title = photo.title || "";
    const username = photo.username || "";
    const titleBuf = Buffer.from(title, "utf-8");
    const usernameBuf = Buffer.from(username, "utf-8");
    const header = Buffer.alloc(4);
    header.writeUInt16BE(titleBuf.length, 0);
    header.writeUInt16BE(usernameBuf.length, 2);

    let finalBuffer;
    if (fileExists) {
      // Si existe el archivo binario, lo descargamos y enviamos directamente
      console.log("Descargando archivo binario");
      const fileStream = await downloadFile(fileNameMinioBin);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      finalBuffer = Buffer.concat(chunks);
    } else {
      // Si no existe, procesamos la imagen y creamos el archivo binario
      const fileStream = await downloadFile(fileNameMinio);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const rgbBuffer = await sharp(buffer)
        .resize(64, 64)
        .removeAlpha()
        .raw()
        .toBuffer();

      finalBuffer = Buffer.concat([header, titleBuf, usernameBuf, rgbBuffer]);

      // Subimos el archivo binario procesado a MinIO
      await uploadFile(
        finalBuffer,
        fileNameMinioBin,
        "application/octet-stream"
      );
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", finalBuffer.length.toString());
    res.send(finalBuffer);
  } catch (err) {
    console.error("Error al procesar la imagen:", err);
    res.status(500).send("Error al generar la imagen");
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

export async function postPublicPhoto(req: Request, res: Response) {
  try {
    console.log("Empezando postPublicPhoto");
    const { title, photoFile } = req.body;

    console.log("📸 Subiendo foto:", title);
    if (!photoFile) {
      console.log("❌ Error: datos incompletos.");
      res.status(400).send("Error: datos incompletos.");
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
    const fileNameMinio = `public/${Date.now()}_${title}.png`;
    const photoUrlMinio = await uploadFile(
      processedImage,
      fileNameMinio,
      "image/png"
    );

    console.log("📤 Foto subida a Minio");

    console.log("🔗 URL:", photoUrlMinio);

    // 📌 Guardar en la base de datos
    const newPhoto = await prisma.photos.create({
      data: {
        user_id: 0,
        title: title,
        photo_url: fileNameMinio,
        username: "",
        created_at: new Date(),
        photo_pixels: await photoToPixelMatrix(processedImage),
      },
      include: {
        users: true,
      },
    });

    await publishToMQTT(
      `pixie/3`,
      JSON.stringify({
        action: "update_photo",
        id: newPhoto.id,
      })
    );

    res.status(201).json(newPhoto);
  } catch (err) {
    console.error("❌ /post-photo error:", err);
    res.status(500).send("Error al subir la foto.");
  }
}

export async function getPhotoByPixie(req: Request, res: Response) {
  const index = Number(req.query.index);
  const pixieIdParam = Array.isArray(req.query.pixieId)
    ? req.query.pixieId[0]
    : req.query.pixieId;

  if (!pixieIdParam) {
    res.status(400).send('Error: parámetro "pixieId" inválido.');
    return;
  }

  const pixieId = parseInt(String(pixieIdParam), 10);
  if (isNaN(pixieId) || pixieId < 0) {
    res.status(400).send('Error: parámetro "pixieId" inválido.');
    return;
  }

  try {
    const pixie = await prisma.pixie.findUnique({
      where: {
        id: pixieId,
      },
    });

    if (!pixie || !pixie.created_by) {
      res.status(404).send("Error: Pixie no encontrado o no tiene propietario.");
      return;
    }

    const photos = await prisma.photos.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                visible_by: {
                  some: {
                    user_id: pixie.created_by,
                  },
                },
              },
              {
                user_id: pixie.created_by,
              },
            ],
          },
          {
            deleted_at: null,
          },
        ],
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const photo = photos[index % photos.length];
    if (!photo?.photo_url) {
      res.status(404).send("Foto no encontrada.");
      return;
    }

    const fileNameMinio = photo.photo_url;
    const fileNameMinioBin = fileNameMinio + ".bin";
    const fileExists = await checkFile(fileNameMinioBin);

    const title = photo.title || "";
    const username = photo.username || "";
    const titleBuf = Buffer.from(title, "utf-8");
    const usernameBuf = Buffer.from(username, "utf-8");
    const header = Buffer.alloc(4);
    header.writeUInt16BE(titleBuf.length, 0);
    header.writeUInt16BE(usernameBuf.length, 2);

    let finalBuffer;
    if (fileExists) {
      const fileStream = await downloadFile(fileNameMinioBin);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      finalBuffer = Buffer.concat(chunks);
    } else {
      const fileStream = await downloadFile(fileNameMinio);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const rgbBuffer = await sharp(buffer)
        .resize(64, 64)
        .removeAlpha()
        .raw()
        .toBuffer();

      finalBuffer = Buffer.concat([header, titleBuf, usernameBuf, rgbBuffer]);

      await uploadFile(
        finalBuffer,
        fileNameMinioBin,
        "application/octet-stream"
      );
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", finalBuffer.length.toString());
    res.send(finalBuffer);
  } catch (err) {
    console.error("Error al procesar la imagen:", err);
    res.status(500).send("Error al generar la imagen");
  }
}
