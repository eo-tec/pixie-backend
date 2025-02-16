// src/controllers/spotify.controller.ts
import { Request, Response } from 'express';
import sharp from 'sharp';
import * as fs from 'fs';

import { SpotifyService } from '../../services/spotify.service';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } from '../../config';

// Instancia global (o podrías inyectarla)
const spotifyService = new SpotifyService(
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI
);

let ACCESS_TOKEN = null;
const REFRESH_TOKEN_FILE = '../../refresh_token.cache';

export async function login(req: Request, res: Response) {
  // Creas la URL de autorización
  const scopes = ['user-read-currently-playing', 'user-read-playback-state', 'user-read-private'];
  const state = 'someRandomState'; // replace with a valid state value as needed
  const authorizeURL = spotifyService.getApi().createAuthorizeURL(scopes, state);
  res.redirect(authorizeURL);
}

export async function callback(req: Request, res: Response) {
  const code = req.query.code || null;
  if (!code) {
    res.send('Error: falta el parámetro "code".');
    return
  }
  try {
    const data = await spotifyService.getApi().authorizationCodeGrant(code as string);
    const accessToken = data.body.access_token;
    const refreshToken = data.body.refresh_token;

    spotifyService.getApi().setAccessToken(accessToken);
    spotifyService.getApi().setRefreshToken(refreshToken);

    // Guardar el refresh token
    spotifyService.saveNewRefreshToken(refreshToken);

    res.send('¡Autorización exitosa! Ahora puedes usar el servidor.');
  } catch (err) {
    console.error('Error en el intercambio de tokens:', err);
    res.status(500).send('Error al obtener el token.');
  }
}

export async function cover64x64(req: Request, res: Response) {
  try {
    // Refresca el token si es necesario
    await spotifyService.refreshAccessTokenIfNeeded();

    const playbackState = await spotifyService.getApi().getMyCurrentPlayingTrack();
    if (!playbackState.body || !playbackState.body.item) {
      res.status(404).send('No se está reproduciendo ninguna canción.');
      return
    }

    let coverUrl: string;
    if ('album' in playbackState.body.item && playbackState.body.item.album.images.length > 0) {
      coverUrl = playbackState.body.item.album.images[0].url;
    } else if ('show' in playbackState.body.item && playbackState.body.item.show.images.length > 0) {
      coverUrl = playbackState.body.item.show.images[0].url;
    } else {
      res.status(404).send('No se encontró portada adecuada.');
      return
    }
    const response = await fetch(coverUrl);
    if (!response.ok) {
      throw new Error(`Error fetching image from URL: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    await sharp(buffer).metadata(); // (metadata no se usa, solo como ejemplo)

    const resizedBuffer = await sharp(buffer)
      .resize(64, 64)
      .ensureAlpha()
      .raw()
      .toBuffer();

    const pixelData: number[][] = [];
    for (let y = 0; y < 64; y++) {
      const row: number[] = [];
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        const r = resizedBuffer[idx];
        const g = resizedBuffer[idx + 1];
        const b = resizedBuffer[idx + 2];

        // Convertir a RGB565
        const rgb565 =
          ((b & 0b11111000) << 8) | // 5 bits de rojo
          ((r & 0b11111100) << 3) | // 6 bits de verde
          (g >> 3); // 5 bits de azul
        row.push(rgb565);
      }
      pixelData.push(row);
    }

    res.json({
      width: 64,
      height: 64,
      data: pixelData,
    });
  } catch (err) {
    console.error('/cover-64x64 error:', err);
    res.status(500).send('Error al procesar la portada.');
  }
}

export async function idPlaying(req: Request, res: Response) {
  try {
    await refreshAccessTokenIfNeeded(); // Asegúrate de que el token está actualizado
    const playbackState = await spotifyService.getApi().getMyCurrentPlaybackState();

    // Verificar si hay canción en reproducción
    if (!playbackState.body || playbackState.body.is_playing === false) {
      res.json({ id: "" }); // Devuelve un string vacío si no hay canción
      return
    }

    let songId = ""; // ID de la canción
    if (playbackState.body.item) {
      songId = playbackState.body.item.id;
    }
    res.json({ id: songId }); // Devuelve el ID de la canción en JSON
  } catch (err) {
    console.error('/id-playing error:', err);
    res.status(500).json({ error: 'Error al obtener la canción actual.' });
  }
}

async function refreshAccessTokenIfNeeded() {
  try {
    const data = await spotifyService.getApi().refreshAccessToken();
    ACCESS_TOKEN = data.body.access_token;
    spotifyService.getApi().setAccessToken(ACCESS_TOKEN);
  } catch (err) {
    console.error('Error al refrescar el Access Token:', err);
    throw new Error('No se pudo refrescar el Access Token.');
  }
}

// -------------------------------------------------------------------
function loadRefreshToken() {
  if (fs.existsSync(REFRESH_TOKEN_FILE)) {
    const token = fs.readFileSync(REFRESH_TOKEN_FILE, 'utf-8').trim();
    console.log('Refresh Token cargado desde el archivo.');
    return token;
  }
  return null;
}

// -------------------------------------------------------------------
// 2. Guardar el Refresh Token en un archivo
// -------------------------------------------------------------------
function saveRefreshToken(token: any) {
  fs.writeFileSync(REFRESH_TOKEN_FILE, token, 'utf-8');
  console.log('Refresh Token guardado en el archivo.');
}



export async function me(req: Request, res: Response) {
  try {
    await refreshAccessTokenIfNeeded(); // Refresca el token si es necesario
    const meData = await spotifyService.getApi().getMe();
    res.json({
      display_name: meData.body.display_name,
      email: meData.body.email,
      country: meData.body.country,
    });
  } catch (err) {
    console.error('/me error:', err);
    res.status(500).send('Error al obtener información del usuario.');
  }
}