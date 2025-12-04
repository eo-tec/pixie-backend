// src/mqtt/handlers.ts
// Handlers para requests MQTT del ESP32

import sharp from 'sharp';
import SpotifyWebApi from 'spotify-web-api-node';
import prisma from '../services/prisma';
import { downloadFile, getPresignedUrlBin } from '../minio/minio';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } from '../config';
import { publishBinary, publishToMQTT } from './client';

// ============================================================================
// HANDLER: Register Request (via MQTT)
// Topic: pixie/mac/{MAC}/request/register -> pixie/mac/{MAC}/response/register
// Response: {"pixieId": N, "code": "0000"}
// ============================================================================
export async function handleRegisterRequest(mac: string): Promise<void> {
  const responseTopic = `pixie/mac/${mac}/response/register`;

  try {
    console.log(`[MQTT:register] Solicitud de registro para MAC: ${mac}`);

    // Buscar pixie existente por MAC
    let pixie = await prisma.pixie.findFirst({
      where: { mac: mac }
    });

    if (pixie) {
      console.log(`[MQTT:register] Pixie existente encontrado: ${pixie.id}`);
    } else {
      // Crear nuevo pixie con code "0000"
      pixie = await prisma.pixie.create({
        data: {
          mac: mac,
          name: "Pixie",
          code: "0000",
          pictures_on_queue: 5
        }
      });
      console.log(`[MQTT:register] Nuevo pixie creado: ${pixie.id}`);
    }

    // Enviar respuesta
    publishToMQTT(responseTopic, {
      pixieId: pixie.id,
      code: pixie.code || "0000"
    });

    console.log(`[MQTT:register] Respuesta enviada a ${responseTopic}`);
  } catch (err) {
    console.error(`[MQTT:register] Error para MAC ${mac}:`, err);
  }
}

// ============================================================================
// HELPER: Obtener credenciales Spotify para un Pixie
// ============================================================================
async function getSpotifyCredentialsForPixie(pixie_id: number) {
  const pixie = await prisma.pixie.findUnique({
    where: { id: pixie_id },
    include: { users: true }
  });

  if (!pixie || !pixie.users) {
    throw new Error('Pixie no encontrado o sin usuario asociado');
  }

  const credentials = await prisma.spotify_credentials.findFirst({
    where: { user_id: pixie.users.id }
  });

  if (!credentials) {
    throw new Error('Usuario sin credenciales de Spotify');
  }

  const now = new Date();

  if (!credentials.expires_at || credentials.expires_at < now) {
    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      redirectUri: SPOTIFY_REDIRECT_URI
    });

    if (!credentials.spotify_refresh_token) {
      throw new Error('No se encontró el refresh token');
    }

    spotifyApi.setRefreshToken(credentials.spotify_refresh_token);
    const data = await spotifyApi.refreshAccessToken();

    const expiresIn = data.body.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.spotify_credentials.update({
      where: { id: credentials.id },
      data: {
        spotify_secret: data.body.access_token,
        expires_at: expiresAt
      }
    });

    return {
      access_token: data.body.access_token,
      refresh_token: credentials.spotify_refresh_token || ''
    };
  }

  return {
    access_token: credentials.spotify_secret || '',
    refresh_token: credentials.spotify_refresh_token || ''
  };
}

// ============================================================================
// HANDLER: Song Request
// Topic: pixie/{id}/request/song -> pixie/{id}/response/song
// Response: {"id":"spotifyTrackId"} o {}
// ============================================================================
export async function handleSongRequest(pixieId: number): Promise<void> {
  const responseTopic = `pixie/${pixieId}/response/song`;

  try {
    const credentials = await getSpotifyCredentialsForPixie(pixieId);

    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      redirectUri: SPOTIFY_REDIRECT_URI
    });
    spotifyApi.setAccessToken(credentials.access_token);

    const playbackState = await spotifyApi.getMyCurrentPlaybackState();

    if (!playbackState.body || playbackState.body.is_playing === false) {
      publishToMQTT(responseTopic, { id: '' });
      return;
    }

    const songId = playbackState.body.item?.id || '';
    publishToMQTT(responseTopic, { id: songId });
  } catch (err) {
    console.error(`[MQTT:song] Error para pixie ${pixieId}:`, err);
    // No enviar respuesta en caso de error - el ESP32 tiene timeout
  }
}

// ============================================================================
// HANDLER: Cover Request
// Topic: pixie/{id}/request/cover -> pixie/{id}/response/cover
// Response: 8192 bytes binarios RGB565 (64x64, Big Endian)
// ============================================================================
export async function handleCoverRequest(pixieId: number, songId: string): Promise<void> {
  const responseTopic = `pixie/${pixieId}/response/cover`;

  try {
    const credentials = await getSpotifyCredentialsForPixie(pixieId);

    const spotifyApi = new SpotifyWebApi({
      clientId: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      redirectUri: SPOTIFY_REDIRECT_URI
    });
    spotifyApi.setAccessToken(credentials.access_token);

    const playbackState = await spotifyApi.getMyCurrentPlayingTrack();

    if (!playbackState.body || !playbackState.body.item) {
      console.log(`[MQTT:cover] No hay canción reproduciéndose para pixie ${pixieId}`);
      return;
    }

    let coverUrl: string | undefined;
    const item = playbackState.body.item;

    if ('album' in item && item.album.images.length > 0) {
      coverUrl = item.album.images[0].url;
    } else if ('show' in item && item.show.images.length > 0) {
      coverUrl = item.show.images[0].url;
    }

    if (!coverUrl) {
      console.log(`[MQTT:cover] No se encontró portada para pixie ${pixieId}`);
      return;
    }

    const response = await fetch(coverUrl);
    if (!response.ok) {
      throw new Error(`Error fetching image: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const resizedBuffer = await sharp(buffer)
      .resize(64, 64)
      .ensureAlpha()
      .raw()
      .toBuffer();

    // Crear buffer binario RGB565 (8192 bytes)
    const binaryBuffer = Buffer.alloc(64 * 64 * 2);

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        const r = resizedBuffer[idx];
        const g = resizedBuffer[idx + 1];
        const b = resizedBuffer[idx + 2];

        // Convertir a RGB565 con corrección BGR
        const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);

        // Escribir en big-endian
        const bufferIdx = (y * 64 + x) * 2;
        binaryBuffer[bufferIdx] = (rgb565 >> 8) & 0xFF;
        binaryBuffer[bufferIdx + 1] = rgb565 & 0xFF;
      }
    }

    publishBinary(responseTopic, binaryBuffer);
    console.log(`[MQTT:cover] Cover enviado a pixie ${pixieId} (${binaryBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[MQTT:cover] Error para pixie ${pixieId}:`, err);
  }
}

// ============================================================================
// HANDLER: Photo Request
// Topic: pixie/{id}/request/photo -> pixie/{id}/response/photo
// Response: {"title":"x","author":"y"}\n + 12288 bytes RGB888
// ============================================================================
export async function handlePhotoRequest(
  pixieId: number,
  payload: { index?: number; id?: number }
): Promise<void> {
  const responseTopic = `pixie/${pixieId}/response/photo`;

  try {
    let photo;

    if (payload.id !== undefined) {
      // Buscar por ID específico
      photo = await prisma.photos.findFirst({
        where: {
          id: payload.id,
          deleted_at: null
        }
      });
    } else {
      // Buscar por índice en las fotos del pixie
      const pixie = await prisma.pixie.findUnique({
        where: { id: pixieId }
      });

      if (!pixie || !pixie.created_by) {
        console.log(`[MQTT:photo] Pixie ${pixieId} no encontrado o sin propietario`);
        return;
      }

      const photos = await prisma.photos.findMany({
        where: {
          AND: [
            {
              OR: [
                { visible_by: { some: { user_id: pixie.created_by } } },
                { user_id: pixie.created_by }
              ]
            },
            { deleted_at: null }
          ]
        },
        orderBy: { created_at: 'desc' }
      });

      if (photos.length === 0) {
        console.log(`[MQTT:photo] No hay fotos para pixie ${pixieId}`);
        return;
      }

      const index = payload.index ?? 0;
      photo = photos[index % photos.length];
    }

    if (!photo?.photo_url) {
      console.log(`[MQTT:photo] Foto no encontrada`);
      return;
    }

    // Descargar imagen de MinIO
    const fileStream = await downloadFile(photo.photo_url);
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Procesar imagen a 64x64 RGB888
    const rgbBuffer = await sharp(buffer)
      .resize(64, 64)
      .removeAlpha()
      .raw()
      .toBuffer();

    // Preparar metadata JSON
    const title = (photo.title || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\n/g, '');

    const author = (photo.username || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const jsonMeta = JSON.stringify({ title, author });
    const jsonBuffer = Buffer.from(jsonMeta + '\n', 'utf-8');

    // Concatenar: JSON + newline + binario
    const finalBuffer = Buffer.concat([jsonBuffer, rgbBuffer]);

    publishBinary(responseTopic, finalBuffer);
    console.log(`[MQTT:photo] Foto enviada a pixie ${pixieId}: "${title}" (${finalBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[MQTT:photo] Error para pixie ${pixieId}:`, err);
  }
}

// ============================================================================
// HANDLER: OTA Request
// Topic: pixie/{id}/request/ota -> pixie/{id}/response/ota
// Response: {"version":15,"url":"https://..."}
// ============================================================================
export async function handleOtaRequest(pixieId: number): Promise<void> {
  const responseTopic = `pixie/${pixieId}/response/ota`;

  try {
    const version = await prisma.code_versions.findFirst({
      orderBy: { created_at: 'desc' }
    });

    if (!version) {
      console.log(`[MQTT:ota] No hay versiones disponibles`);
      return;
    }

    const url = await getPresignedUrlBin(version.url);

    publishToMQTT(responseTopic, {
      version: version.version,
      url: url
    });

    console.log(`[MQTT:ota] Versión ${version.version} enviada a pixie ${pixieId}`);
  } catch (err) {
    console.error(`[MQTT:ota] Error para pixie ${pixieId}:`, err);
  }
}

// ============================================================================
// HANDLER: Config Request
// Topic: pixie/{id}/request/config -> pixie/{id}/response/config
// Response: {"brightness":50,"pictures_on_queue":10,"spotify_enabled":true,...}
// ============================================================================
export async function handleConfigRequest(pixieId: number): Promise<void> {
  const responseTopic = `pixie/${pixieId}/response/config`;

  try {
    const pixie = await prisma.pixie.findUnique({
      where: { id: pixieId }
    });

    if (!pixie) {
      console.log(`[MQTT:config] Pixie ${pixieId} no encontrado`);
      return;
    }

    // Contar fotos disponibles para este pixie
    let picturesOnQueue = 0;
    if (pixie.created_by) {
      const photoCount = await prisma.photos.count({
        where: {
          AND: [
            {
              OR: [
                { visible_by: { some: { user_id: pixie.created_by } } },
                { user_id: pixie.created_by }
              ]
            },
            { deleted_at: null }
          ]
        }
      });
      picturesOnQueue = photoCount;
    }

    publishToMQTT(responseTopic, {
      brightness: pixie.brightness ?? 50,
      pictures_on_queue: picturesOnQueue,
      spotify_enabled: pixie.spotify_enabled ?? false,
      secs_between_photos: pixie.secs_between_photos ?? 30,
      code: pixie.code ?? ''
    });

    console.log(`[MQTT:config] Config enviada a pixie ${pixieId}`);
  } catch (err) {
    console.error(`[MQTT:config] Error para pixie ${pixieId}:`, err);
  }
}
