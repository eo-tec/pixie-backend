// src/controllers/photos.controller.ts
import { Request, Response } from "express";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { downloadFile } from "../../minio/minio";

const prisma = new PrismaClient();

export async function getPhoto(req: Request, res: Response) {
  const id = parseInt(String(req.query.id), 10);
  if (isNaN(id) || id < 0) {
    res.status(400).send('Error: parámetro "id" inválido.');
    return;
  }
  try {
    /*const pixieIdParam = Array.isArray(req.query.pixieId) ? req.query.pixieId[0] : req.query.pixieId;
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
		  // Consulta a Supabase para obtener las últimas 5 fotos subidas
		  // 1. Obtener el usuario que creó el Pixie
		  const { data: pixieData, error: pixieError } = await supabase
			.from('pixie')
			.select('created_by')
			.eq('id', pixieId)
			.single();
	  
		  if (pixieError || !pixieData) {
			console.error('Error al obtener el pixie:', pixieError?.message);
			return;
		  }
	  
		  const createdBy = pixieData.created_by;
		  if (createdBy === null) {
			res.status(404).send('Pixie no encontrado.');
			return;
		  }
	  
		  // 2. Obtener los grupos a los que está suscrito ese usuario
		  const { data: groupData, error: groupError } = await supabase
			.from('group_suscriber')
			.select('group')
			.eq('user', createdBy);
	  
		  if (groupError || !groupData || groupData.length === 0) {
			console.error('Error al obtener los grupos:', groupError?.message);
			return;
		  }
	  
		  const groupIds = groupData.map(g => g.group);
	  
		  // 3. Obtener las fotos asociadas a esos grupos a través de la tabla intermedia 'photo_groups'
		  const { data: photoGroups, error: photoGroupsError } = await supabase
			.from('photo_groups')
			.select('photo_id')
			.in('group_id', groupIds);
	  
		  if (photoGroupsError || !photoGroups || photoGroups.length === 0) {
			console.error('Error al obtener las fotos de los grupos:', photoGroupsError?.message);
			return;
		  }
	  
		  const photoIds = photoGroups.map(pg => pg.photo_id);
	  
		  // 4. Obtener las fotos usando los IDs obtenidos de 'photo_groups'
		  const { data: photos, error: photosError } = await supabase
			.from('photos')
			.select('photo_url, title, username')
			.in('id', photoIds)
			.order('created_at', { ascending: false })
			.limit(5);
	  
	  
		  if (photosError) {
			console.error('Error al obtener las fotos:', photosError.message);
			return;
		  }
	  
		  if (!photos || photos.length === 0) {
			res.status(404).send('No se encontraron fotos.');
			return;
		  }
	  
		  // De esta forma nunca se va a pasar del límite de 5 fotos
		  const photo = photos[id % photos.length];
		  if (!photo.photo_url) {
			res.status(404).send('Foto no encontrada.');
			return
		  }*/

    const photos = await prisma.photos.findMany({
      orderBy: {
        created_at: "desc",
      },
      take: 5,
    });

    const photo = photos[id % photos.length];

    // Verificar si photo_pixels existe y tiene contenido
    if (photo.photo_pixels && Array.isArray(photo.photo_pixels) && photo.photo_pixels.length > 0) {
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

    console.log("Este es el url", photo?.photo_url)
    const fileName = photo?.photo_url?.split('/').pop() || '';
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
      data: { photo_pixels: pixelData }
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

export async function getPhotoBinary(req: Request, res: Response) {
  const id = parseInt(String(req.query.id), 10);
  if (isNaN(id) || id < 0) {
    res.status(400).send('Error: parámetro "id" no válido.');
    return;
  }

  try {
    const photos = await prisma.photos.findMany({
      orderBy: { created_at: "desc" },
      take: 5,
    });

    const photo = photos[id % photos.length];
    if (!photo) {
      res.status(404).send("Foto no encontrada.");
      return 
    }

    // Normalizar campos de texto
    const cleanUsername = photo.username
      ? photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : "";

    const clearTitle = photo.title
      ? photo.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\n/g, "")
      : "";

    let imageData: Buffer;

    if (
      Array.isArray(photo.photo_pixels) &&
      photo.photo_pixels.length === 64 &&
      Array.isArray(photo.photo_pixels[0]) &&
      photo.photo_pixels[0].length === 64
    ) {
      // Si ya está en la base de datos
      imageData = Buffer.alloc(64 * 64 * 2);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const rgb565 = (photo.photo_pixels as number[][])[y][x];
          imageData.writeUInt16BE(rgb565, (y * 64 + x) * 2);
        }
      }
    } else {
      // Descargar, recortar y convertir la imagen
      const fileName = photo.photo_url?.split('/').pop() || '';
      const fileStream = await downloadFile(fileName);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Dimensiones no disponibles.");
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

      imageData = Buffer.alloc(64 * 64 * 2);
      const pixelData: number[][] = [];

      for (let y = 0; y < 64; y++) {
        const row: number[] = [];
        for (let x = 0; x < 64; x++) {
          const idx = (y * 64 + x) * 4;
          let r = resizedBuffer[idx];
          let g = resizedBuffer[idx + 1];
          let b = resizedBuffer[idx + 2];
          const a = resizedBuffer[idx + 3];

          if (a === 0) {
            r = 255;
            g = 255;
            b = 255;
          }

          const rgb565 =
            ((r & 0xF8) << 8) |
            ((g & 0xFC) << 3) |
            (b >> 3);

          imageData.writeUInt16BE(rgb565, (y * 64 + x) * 2);
          row.push(rgb565);
        }
        pixelData.push(row);
      }

      // Guardar en la base de datos para futuros usos
      await prisma.photos.update({
        where: { id: photo.id },
        data: { photo_pixels: pixelData },
      });
    }

    // Construir el binario final con cabecera
    const titleBuffer = Buffer.from(clearTitle, "utf-8");
    const usernameBuffer = Buffer.from(cleanUsername, "utf-8");

    const header = Buffer.alloc(4);
    header.writeUInt16BE(titleBuffer.length, 0);
    header.writeUInt16BE(usernameBuffer.length, 2);

    const finalBuffer = Buffer.concat([
      header,
      titleBuffer,
      usernameBuffer,
      imageData,
    ]);

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(finalBuffer);
  } catch (err) {
    console.error("/get-photo-binary error:", err);
    res.status(500).send("Error al procesar la imagen.");
  }
}

