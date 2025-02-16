// src/controllers/photos.controller.ts
import { Request, Response } from 'express';
import sharp from 'sharp';
import { supabase } from '../../config';

export async function getPhoto(req: Request, res: Response) {
  const id = parseInt(String(req.query.id), 10);
  if (isNaN(id) || id < 0) {
    res.status(400).send('Error: parámetro "id" inválido.');
    return
  }

  const pixieIdParam = Array.isArray(req.query.pixieId) ? req.query.pixieId[0] : req.query.pixieId;
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
    }
    const response = await fetch(photo.photo_url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const metadata = await sharp(buffer).metadata();
    if (metadata.width === undefined || metadata.height === undefined) {
      throw new Error("Error: No se pudieron obtener las dimensiones de la imagen.");
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
        const r = resizedBuffer[idx];
        const g = resizedBuffer[idx + 1];
        const b = resizedBuffer[idx + 2];

        // Convertir a RGB565: 5 bits rojo, 6 bits verde y 5 bits azul
        const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
        row.push(rgb565);
      }
      pixelData.push(row);
    }

    if (!photo.username || !photo.title) {
      res.status(404).send('Foto no encontrada.');
      return
    }
    const cleanUsername = photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const clearTitle = photo.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    res.json({
      photo: {
        width: 64,
        height: 64,
        data: pixelData,
      },
      title: clearTitle,
      username: cleanUsername,
    });
  } catch (err) {
    console.error('/get-photo error:', err);
    res.status(500).send('Error al procesar la solicitud.');
  }
}
