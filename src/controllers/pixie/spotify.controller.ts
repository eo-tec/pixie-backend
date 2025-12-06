// src/controllers/spotify.controller.ts
import { Request, Response } from 'express';
import sharp from 'sharp';
import * as fs from 'fs';

import { SpotifyService } from '../../services/spotify.service';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } from '../../config';
import { PrismaClient } from '@prisma/client';
import SpotifyWebApi from 'spotify-web-api-node';

const prisma = new PrismaClient();

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
  const user_id = req.query.state || null;
  if (!code) {
    res.status(400).json({ error: 'Falta el parámetro "code"' });
    return;
  }

  try {
    const data = await spotifyService.getApi().authorizationCodeGrant(code as string);


    if (data){
      const spotify_credentials = await prisma.spotify_credentials.upsert({
        where: {
          user_id: parseInt(user_id as string),
        },
        update: {
          spotify_secret: data.body.access_token,
          spotify_refresh_token: data.body.refresh_token,
          expires_at: new Date(Date.now() + data.body.expires_in * 1000),
        },
        create: {
          spotify_id: user_id as string,
          spotify_secret: data.body.access_token,
          spotify_refresh_token: data.body.refresh_token,
          expires_at: new Date(Date.now() + data.body.expires_in * 1000),
          user_id: parseInt(user_id as string)
        },
      });

    }

    res.redirect(process.env.SETTINGS_URI || "https://app.mypixelframe.com/settings");
    
  } catch (err) {
    console.error('Error en el intercambio de tokens:', err);
    res.status(500).json({ 
      error: 'Error al obtener el token',
      details: err instanceof Error ? err.message : 'Error desconocido'
    });
  }
}

async function getSpotifyCredentialsForPixie(pixie_id: number) {
  // Buscamos el pixie y su usuario creador
  const pixie = await prisma.pixie.findUnique({
    where: { id: pixie_id },
    include: { users: true }
  });

  if (!pixie || !pixie.users) {
    throw new Error('Pixie no encontrado o sin usuario asociado');
  }

  // Buscamos las credenciales de Spotify del usuario
  const credentials = await prisma.spotify_credentials.findFirst({
    where: { user_id: pixie.users.id }
  });

  if (!credentials) {
    throw new Error('Usuario sin credenciales de Spotify');
  }

  // Verificamos si necesitamos refrescar el token
  const now = new Date();
  
  if (!credentials.expires_at || credentials.expires_at < now) {
    try {
      // // Creamos una instancia temporal del servicio de Spotify
      // const tempSpotifyService = new SpotifyService(
      //   SPOTIFY_CLIENT_ID,
      //   SPOTIFY_CLIENT_SECRET,
      //   SPOTIFY_REDIRECT_URI
      // );

      const spotifyApi = new SpotifyWebApi({ clientId: SPOTIFY_CLIENT_ID, clientSecret: SPOTIFY_CLIENT_SECRET, redirectUri: SPOTIFY_REDIRECT_URI });
      if(!credentials.spotify_refresh_token) {
        throw new Error('No se encontró el refresh token');
      }

      spotifyApi.setRefreshToken(credentials.spotify_refresh_token);


      // Refrescamos el token
      const data = await spotifyApi.refreshAccessToken();
      
      
      // Calculamos el tiempo de expiración usando el valor real de Spotify
      const expiresIn = data.body.expires_in || 3600; // Default 1 hora si no viene el valor
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Actualizamos las credenciales en la base de datos
      await prisma.spotify_credentials.update({
        where: { id: credentials.id },
        data: {
          spotify_secret: data.body.access_token, // Guardamos el nuevo access_token en spotify_secret
          expires_at: expiresAt
        }
      });

      return {
        access_token: data.body.access_token,
        refresh_token: credentials.spotify_refresh_token || ''
      };
    } catch (error: any) {
      console.error('❌ Error al refrescar el token:', error);
      if (error.body) {
        console.error('Error body:', error.body);
      }
      if (error.statusCode) {
        console.error('Status code:', error.statusCode);
        if (error.statusCode === 400) {
          console.error('🔴 Error 400: Refresh token inválido. El usuario debe reautorizar la app.');
        }
      }
      throw new Error('Error al refrescar el token de Spotify');
    }
  }

  // Si el token no ha expirado, devolvemos las credenciales actuales
  return {
    access_token: credentials.spotify_secret || '', // Usamos spotify_secret como access_token
    refresh_token: credentials.spotify_refresh_token || ''
  };
}

export async function cover64x64(req: Request, res: Response) {
  try {
    const { pixie_id } = req.query;

    if (!pixie_id) {
      res.status(400).json({ error: 'Se requiere el pixie_id' });
      return;
    }

    // Obtenemos las credenciales de Spotify
    const credentials = await getSpotifyCredentialsForPixie(Number(pixie_id));

    // Configuramos el servicio de Spotify con las credenciales
    spotifyService.getApi().setAccessToken(credentials.access_token);

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
    res.status(500).json({ error: 'Error al procesar la portada.' });
  }
}

export async function cover64x64Binary(req: Request, res: Response) {
  try {
    const { pixie_id } = req.query;

    if (!pixie_id) {
      res.status(400).json({ error: 'Se requiere el pixie_id' });
      return;
    }

    // Obtenemos las credenciales de Spotify
    const credentials = await getSpotifyCredentialsForPixie(Number(pixie_id));

    // Configuramos el servicio de Spotify con las credenciales
    spotifyService.getApi().setAccessToken(credentials.access_token);

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

    const resizedBuffer = await sharp(buffer)
      .resize(64, 64)
      .ensureAlpha()
      .raw()
      .toBuffer();

    // Crear buffer binario RGB565
    const binaryBuffer = Buffer.alloc(64 * 64 * 2); // 2 bytes por pixel
    
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        const r = resizedBuffer[idx];
        const g = resizedBuffer[idx + 1];
        const b = resizedBuffer[idx + 2];

        // Convertir a RGB565 con corrección BGR
        const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
        
        // Escribir en el buffer binario (big-endian)
        const bufferIdx = (y * 64 + x) * 2;
        binaryBuffer[bufferIdx] = (rgb565 >> 8) & 0xFF;
        binaryBuffer[bufferIdx + 1] = rgb565 & 0xFF;
      }
    }

    // Enviar como datos binarios
    res.set('Content-Type', 'application/octet-stream');
    res.send(binaryBuffer);
  } catch (err) {
    console.error('/cover-64x64-binary error:', err);
    res.status(500).json({ error: 'Error al procesar la portada.' });
  }
}

export async function idPlaying(req: Request, res: Response) {
  try {
    const { pixie_id } = req.query;

    if (!pixie_id) {
      res.status(400).json({ error: 'Se requiere el pixie_id' });
      return;
    }


    // Obtenemos las credenciales de Spotify
    const credentials = await getSpotifyCredentialsForPixie(Number(pixie_id));

    // Configuramos el servicio de Spotify con las credenciales
    spotifyService.getApi().setAccessToken(credentials.access_token);

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
  } catch (err: any) {
    console.error('/id-playing error:', err);
    
    // Log más detallado del error
    if (err.body) {
      console.error('Error body:', err.body);
    }
    if (err.statusCode) {
      console.error('Status code:', err.statusCode);
    }
    if (err.headers) {
      console.error('Headers:', err.headers);
    }
    
    // Si es error 403, probablemente el token expiró o no tiene permisos
    if (err.statusCode === 403) {
      console.error('🔴 Error 403: Token inválido o sin permisos. El usuario debe reautorizar la app.');
    }
    
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
    return token;
  }
  return null;
}

// -------------------------------------------------------------------
// 2. Guardar el Refresh Token en un archivo
// -------------------------------------------------------------------
function saveRefreshToken(token: any) {
  fs.writeFileSync(REFRESH_TOKEN_FILE, token, 'utf-8');
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

export async function saveCredentials(req: Request, res: Response) {
  try {
    const { spotify_id, spotify_refresh_token, user_id } = req.body;


    if (!spotify_id || !spotify_refresh_token || !user_id) {
      res.status(400).json({ error: 'Faltan parámetros requeridos' });
      return;
    }

    //Buscamos el usuario con el user_id
    const user = await prisma.public_users.findFirst({
      where: {
        user_id: user_id,
      },
    });

    
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Primero buscamos si ya existen credenciales para este usuario
    const existingCredentials = await prisma.spotify_credentials.findFirst({
      where: {
        user_id: user.id,
      },
    });


    let credentials;
    if (existingCredentials) {
      // Si existen, actualizamos
      credentials = await prisma.spotify_credentials.update({
        where: {
          id: existingCredentials.id,
        },
        data: {
          spotify_id: spotify_id,
          spotify_refresh_token: spotify_refresh_token,
        },
      });
    } else {
      // Si no existen, creamos nuevas
      credentials = await prisma.spotify_credentials.create({
        data: {
          spotify_id: spotify_id,
          spotify_refresh_token: spotify_refresh_token,
          spotify_secret: '', // Este campo es requerido por el schema pero no lo usamos en este endpoint
          user_id: user.id,
        },
      });
    }


    res.json({ message: 'Credenciales guardadas correctamente', credentials });
  } catch (err) {
    console.error('Error al guardar credenciales:', err);
    res.status(500).json({ error: 'Error al guardar las credenciales de Spotify' });
  }
}

export async function isLogged(req: Request, res: Response) {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      res.status(400).json({ error: 'Se requiere el user_id' });
      return
    }

    // Primero buscamos el usuario por su user_id para obtener su id
    const user = await prisma.public_users.findFirst({
      where: {
        user_id: user_id as string,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return
    }

    // Buscamos las credenciales de Spotify usando el id del usuario
    const credentials = await prisma.spotify_credentials.findFirst({
      where: {
        user_id: user.id,
      },
    });

    if (!credentials) {
      res.json({ credentials: null });
      return
    }

    res.json({ credentials });
  } catch (err) {
    console.error('Error al verificar credenciales:', err);
    res.status(500).json({ error: 'Error al verificar las credenciales de Spotify' });
  }
}

export async function unlinkSpotify(req: Request, res: Response) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'Se requiere el user_id' });
      return;
    }

    // Buscamos el usuario por su user_id (UUID de Supabase)
    const user = await prisma.public_users.findFirst({
      where: {
        user_id: user_id as string,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Eliminamos las credenciales de Spotify del usuario
    await prisma.spotify_credentials.deleteMany({
      where: {
        user_id: user.id,
      },
    });

    res.json({ message: 'Spotify desvinculado correctamente' });
  } catch (err) {
    console.error('Error al desvincular Spotify:', err);
    res.status(500).json({ error: 'Error al desvincular Spotify' });
  }
}