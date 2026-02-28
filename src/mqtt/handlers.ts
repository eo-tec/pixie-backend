// src/mqtt/handlers.ts
// Handlers para requests MQTT del ESP32

import sharp from 'sharp';
import SpotifyWebApi from 'spotify-web-api-node';
import prisma from '../services/prisma';
import { downloadFile, getPresignedUrlBin } from '../minio/minio';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } from '../config';
import { publishBinary, publishToMQTT } from './client';
import { generateStocksImage } from '../faces/stocks';
import { generateDayNightImage } from '../faces/daynight';

// ============================================================================
// HANDLER: Register Request (via MQTT)
// Topic: frame/mac/{MAC}/request/register -> frame/mac/{MAC}/response/register
// Response: {"pixieId": N, "frameId": N, "code": "0000"}
// ============================================================================
export async function handleRegisterRequest(mac: string): Promise<void> {
  const responseTopic = `frame/mac/${mac}/response/register`;

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
          name: "frame.",
          code: "0000",
          pictures_on_queue: 1
        }
      });
      // Create default playlist item
      await prisma.playlist_items.create({
        data: {
          pixie_id: pixie.id,
          position: 0,
          face_type: 'photos',
          locked: true,
        }
      });
      console.log(`[MQTT:register] Nuevo pixie creado: ${pixie.id}`);
    }

    // Enviar respuesta
    publishToMQTT(responseTopic, {
      pixieId: pixie.id,  // backward compat firmware viejo
      frameId: pixie.id,  // campo nuevo
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
// Topic: frame/{id}/request/song -> frame/{id}/response/song
// Response: {"id":"spotifyTrackId"} o {}
// ============================================================================
export async function handleSongRequest(pixieId: number): Promise<void> {
  const responseTopic = `frame/${pixieId}/response/song`;

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
    console.error(`[MQTT:song] Error para frame ${pixieId}:`, err);
    // No enviar respuesta en caso de error - el ESP32 tiene timeout
  }
}

// ============================================================================
// HANDLER: Cover Request
// Topic: frame/{id}/request/cover -> frame/{id}/response/cover
// Response: 8192 bytes binarios RGB565 (64x64, Big Endian)
// ============================================================================
export async function handleCoverRequest(pixieId: number, songId: string): Promise<void> {
  const responseTopic = `frame/${pixieId}/response/cover`;

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
      console.log(`[MQTT:cover] No hay canción reproduciéndose para frame ${pixieId}`);
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
      console.log(`[MQTT:cover] No se encontró portada para frame ${pixieId}`);
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

    const songName = item?.name || 'Unknown';
    await prisma.pixie.update({
      where: { id: pixieId },
      data: {
        current_song_id: item?.id || songId,
        current_song_name: songName,
        current_photo_id: null,
      },
    });

    console.log(`[MQTT:cover] Cover enviado a frame ${pixieId} (${binaryBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[MQTT:cover] Error para frame ${pixieId}:`, err);
  }
}

// ============================================================================
// HANDLER: Photo Request
// Topic: frame/{id}/request/photo -> frame/{id}/response/photo
// Response: {"title":"x","author":"y"}\n + 12288 bytes RGB888
// ============================================================================
export async function handlePhotoRequest(
  pixieId: number,
  payload: { index?: number; id?: number; reqId?: number }
): Promise<void> {
  const responseTopic = `frame/${pixieId}/response/photo`;

  try {
    const reqId = payload.reqId;

    // Server-push photo by ID - keep untouched
    if (payload.id !== undefined) {
      const photo = await prisma.photos.findFirst({
        where: { id: payload.id, deleted_at: null }
      });
      if (photo) {
        await serveDirectPhoto(pixieId, photo, responseTopic, reqId);
      } else {
        console.log(`[MQTT:photo] Foto no encontrada`);
      }
      return;
    }

    // Playlist-aware dispatch
    const pixie = await prisma.pixie.findUnique({
      where: { id: pixieId },
      include: {
        playlist_items: { orderBy: { position: 'asc' } }
      }
    });

    if (!pixie || !pixie.created_by) {
      console.log(`[MQTT:photo] Frame ${pixieId} no encontrado o sin propietario`);
      return;
    }

    const index = payload.index ?? 0;

    // If no playlist items, fallback to legacy photo behavior
    if (!pixie.playlist_items || pixie.playlist_items.length === 0) {
      await servePhotoFace(pixieId, pixie, responseTopic, reqId);
      return;
    }

    const playlistItem = pixie.playlist_items[index % pixie.playlist_items.length];

    switch (playlistItem.face_type) {
      case 'photos':
        await servePhotoFace(pixieId, pixie, responseTopic, reqId);
        break;
      case 'stocks':
        await serveStocksFace(pixieId, playlistItem, responseTopic, reqId);
        break;
      case 'daynight':
        await serveDayNightFace(pixieId, responseTopic, reqId);
        break;
      default:
        console.log(`[MQTT:photo] Unknown face_type: ${playlistItem.face_type}`);
        await servePhotoFace(pixieId, pixie, responseTopic, reqId);
    }
  } catch (err) {
    console.error(`[MQTT:photo] Error para frame ${pixieId}:`, err);
  }
}

// Helper: serve a specific photo directly (by ID push)
async function serveDirectPhoto(pixieId: number, photo: any, responseTopic: string, reqId?: number): Promise<void> {
  if (!photo?.photo_url) {
    console.log(`[MQTT:photo] Foto sin URL`);
    return;
  }

  const fileStream = await downloadFile(photo.photo_url);
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

  const title = (photo.title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\n/g, '');

  const author = (photo.username || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const metaObj: any = { title, author };
  if (reqId !== undefined) metaObj.reqId = reqId;
  const jsonMeta = JSON.stringify(metaObj);
  const jsonBuffer = Buffer.from(jsonMeta + '\n', 'utf-8');
  const finalBuffer = Buffer.concat([jsonBuffer, rgbBuffer]);

  publishBinary(responseTopic, finalBuffer);

  await prisma.pixie.update({
    where: { id: pixieId },
    data: {
      current_photo_id: photo.id,
      current_song_id: null,
      current_song_name: null,
    },
  });

  console.log(`[MQTT:photo] Foto enviada a frame ${pixieId}: "${title}" reqId=${reqId} (${finalBuffer.length} bytes)`);
}

// Helper: serve photo using photo_cursor (playlist-aware)
async function servePhotoFace(pixieId: number, pixie: any, responseTopic: string, reqId?: number): Promise<void> {
  if (!pixie.created_by) return;

  // Get accessible photos (same friends/visibility logic)
  const friends = await prisma.friends.findMany({
    where: {
      status: 'accepted',
      OR: [
        { user_id_1: pixie.created_by },
        { user_id_2: pixie.created_by }
      ]
    }
  });
  const friendIds = friends.map((f: any) =>
    f.user_id_1 === pixie.created_by ? f.user_id_2 : f.user_id_1
  );

  const photos = await prisma.photos.findMany({
    where: {
      AND: [
        {
          OR: [
            { user_id: pixie.created_by },
            { visible_by: { some: { user_id: pixie.created_by } } },
            ...(friendIds.length > 0 ? [{
              is_public: true,
              user_id: { in: friendIds }
            }] : [])
          ]
        },
        { deleted_at: null }
      ]
    },
    orderBy: { created_at: 'desc' }
  });

  if (photos.length === 0) {
    console.log(`[MQTT:photo] No hay fotos para frame ${pixieId}`);
    return;
  }

  // Limit photo pool when max_photos is set (> 0)
  const pool = pixie.max_photos > 0
    ? photos.slice(0, pixie.max_photos)
    : photos;

  // Use photo_cursor instead of index
  const cursor = pixie.photo_cursor ?? 0;
  const photo = pool[cursor % pool.length];

  // Advance cursor with wrap
  const nextCursor = (cursor + 1) % pool.length;
  await prisma.pixie.update({
    where: { id: pixieId },
    data: { photo_cursor: nextCursor },
  });

  await serveDirectPhoto(pixieId, photo, responseTopic, reqId);
}

// Helper: serve stocks face image
async function serveStocksFace(pixieId: number, playlistItem: any, responseTopic: string, reqId?: number): Promise<void> {
  const config = playlistItem.config as any;
  const ticker = config?.ticker || 'SPY';
  const timeframe = config?.timeframe || '1D';

  try {
    const rgbBuffer = await generateStocksImage(ticker, timeframe);

    const metaObj: any = {};
    if (reqId !== undefined) metaObj.reqId = reqId;
    const jsonMeta = JSON.stringify(metaObj);
    const jsonBuffer = Buffer.from(jsonMeta + '\n', 'utf-8');
    const finalBuffer = Buffer.concat([jsonBuffer, rgbBuffer]);

    publishBinary(responseTopic, finalBuffer);

    await prisma.pixie.update({
      where: { id: pixieId },
      data: {
        current_photo_id: null,
        current_song_id: null,
        current_song_name: null,
      },
    });

    console.log(`[MQTT:photo] Stocks face enviado a frame ${pixieId}: ${ticker} ${timeframe} reqId=${reqId} (${finalBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[MQTT:photo] Error generando stocks face para ${ticker}:`, err);
  }
}

// Helper: serve day/night world map face
async function serveDayNightFace(pixieId: number, responseTopic: string, reqId?: number): Promise<void> {
  try {
    const rgbBuffer = await generateDayNightImage();

    const metaObj: any = {};
    if (reqId !== undefined) metaObj.reqId = reqId;
    const jsonMeta = JSON.stringify(metaObj);
    const jsonBuffer = Buffer.from(jsonMeta + '\n', 'utf-8');
    const finalBuffer = Buffer.concat([jsonBuffer, rgbBuffer]);

    publishBinary(responseTopic, finalBuffer);

    await prisma.pixie.update({
      where: { id: pixieId },
      data: {
        current_photo_id: null,
        current_song_id: null,
        current_song_name: null,
      },
    });

    console.log(`[MQTT:photo] DayNight face enviado a frame ${pixieId} reqId=${reqId} (${finalBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[MQTT:photo] Error generando daynight face:`, err);
  }
}

// ============================================================================
// HANDLER: OTA Request
// Topic: frame/{id}/request/ota -> frame/{id}/response/ota
// Response: {"version":15,"url":"https://..."}
// ============================================================================
export async function handleOtaRequest(pixieId: number): Promise<void> {
  const responseTopic = `frame/${pixieId}/response/ota`;

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

    console.log(`[MQTT:ota] Versión ${version.version} enviada a frame ${pixieId}`);
  } catch (err) {
    console.error(`[MQTT:ota] Error para frame ${pixieId}:`, err);
  }
}

// ============================================================================
// HANDLER: Config Request
// Topic: frame/{id}/request/config -> frame/{id}/response/config
// Response: {"brightness":50,"pictures_on_queue":10,"spotify_enabled":true,...}
// ============================================================================
export async function handleConfigRequest(pixieId: number): Promise<void> {
  const responseTopic = `frame/${pixieId}/response/config`;

  try {
    const pixie = await prisma.pixie.findUnique({
      where: { id: pixieId },
      include: {
        users: true,
        playlist_items: true,
      }
    });

    if (!pixie) {
      console.log(`[MQTT:config] Frame ${pixieId} no encontrado`);
      return;
    }

    const playlistLength = pixie.playlist_items?.length || pixie.pictures_on_queue || 5;

    publishToMQTT(responseTopic, {
      brightness: pixie.brightness ?? 50,
      pictures_on_queue: playlistLength,
      spotify_enabled: pixie.spotify_enabled ?? false,
      secs_between_photos: pixie.secs_between_photos ?? 30,
      schedule_enabled: pixie.schedule_enabled ?? false,
      schedule_on_hour: pixie.schedule_on_hour ?? 8,
      schedule_on_minute: pixie.schedule_on_minute ?? 0,
      schedule_off_hour: pixie.schedule_off_hour ?? 22,
      schedule_off_minute: pixie.schedule_off_minute ?? 0,
      clock_enabled: pixie.clock_enabled ?? false,
      timezone_offset: pixie.users?.timezone_offset ?? 0
    });

    console.log(`[MQTT:config] Config enviada a frame ${pixieId}`);
  } catch (err) {
    console.error(`[MQTT:config] Error para frame ${pixieId}:`, err);
  }
}
