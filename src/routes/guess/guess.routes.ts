// routes/spotify.js (o donde prefieras)
import { Request, Response, Router } from "express";
import { SPOTIFY_REDIRECT_URI } from "../../config";

export const guessRouter = Router();

const CLIENT_ID = "335726d82b904d43b50a3bd69a7d2cbe";
const CLIENT_SECRET = "9d3264ea82774c7cafe7da3be2cff4bc";

guessRouter.get("/", (req, res) => {
  res.send("Hello, world!");
});

guessRouter.get("/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code) {
    res.status(400).json({ error: "No authorization code provided" });
    return;
  }

  let stateData;
  try {
    stateData = JSON.parse(state as string);
  } catch (error) {
    res.status(400).json({ error: "Invalid state parameter" });
    return;
  }

  const { front_uri, code_verifier } = stateData;

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code as string);
  params.append("redirect_uri", SPOTIFY_REDIRECT_URI);
  params.append("client_id", CLIENT_ID);
  params.append("code_verifier", code_verifier);

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await response.json();
    
    if (data.access_token) {
      const redirectUrl = `${front_uri}?access_token=${data.access_token}&refresh_token=${data.refresh_token || ''}`;
      res.redirect(redirectUrl);
    } else {
      res.status(400).json({ error: "Failed to get access token", details: data });
    }
  } catch (err: any) {
    res
      .status(500)
      .json({
        error: "Error al intercambiar el código con Spotify",
        details: err.message,
      });
  }
});

// routes/spotify.js (añade a lo anterior)
guessRouter.get("/playlists", async (req: Request, res: Response) => {
  const { access_token } = req.query;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  try {
    // Fetch user's playlists with limit of 50 to get more data
    const playlistsResponse = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!playlistsResponse.ok) {
      res.status(playlistsResponse.status).json(await playlistsResponse.json());
      return;
    }

    const playlistsData = await playlistsResponse.json();
    
    // Try to get recently played tracks to infer playlist usage
    let recentlyPlayedPlaylists: string[] = [];
    try {
      const recentResponse = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        // Extract playlist contexts from recently played tracks
        const playlistContexts = recentData.items
          ?.filter((item: any) => item.context?.type === 'playlist')
          ?.map((item: any) => item.context.uri.split(':')[2]) || [];
        
        recentlyPlayedPlaylists = [...new Set(playlistContexts as string[])];
      }
    } catch (error) {
      console.log('Could not fetch recently played tracks, falling back to creation date');
    }

    // Sort playlists: recently played first, then by creation date (newest first)
    const sortedPlaylists = playlistsData.items.sort((a: any, b: any) => {
      const aIndex = recentlyPlayedPlaylists.indexOf(a.id);
      const bIndex = recentlyPlayedPlaylists.indexOf(b.id);
      
      // If both are in recently played, sort by their position in recently played
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in recently played, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither is in recently played, sort by creation date (newer first)
      // Spotify doesn't provide creation date, so we'll use the added_at or just keep original order
      // For playlists, we can use the total tracks as a rough indicator of activity
      return (b.tracks?.total || 0) - (a.tracks?.total || 0);
    });

    res.json({
      ...playlistsData,
      items: sortedPlaylists
    });
  } catch (err: any) {
    res
      .status(500)
      .json({
        error: "Error al obtener playlists de Spotify",
        details: err.message,
      });
  }
});

guessRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refresh_token);
    params.append('client_id', CLIENT_ID);
  
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
  
      const data = await response.json();
      res.status(response.ok ? 200 : 400).json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al refrescar el token', details: err.message });
    }
  });

guessRouter.get("/validate", async (req: Request, res: Response) => {
  const { access_token } = req.query;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token", valid: false });
    return;
  }

  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (response.ok) {
      const userData = await response.json();
      res.json({ 
        valid: true, 
        user: {
          id: userData.id,
          display_name: userData.display_name,
          email: userData.email
        }
      });
    } else {
      res.json({ valid: false, error: "Token inválido o expirado" });
    }
  } catch (err: any) {
    res.status(500).json({ 
      valid: false, 
      error: "Error al validar token con Spotify", 
      details: err.message 
    });
  }
});

guessRouter.get("/playlist/:playlistId/random-song", async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { access_token } = req.query;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  if (!playlistId) {
    res.status(400).json({ error: "Falta playlistId" });
    return;
  }

  try {
    // Get playlist tracks
    const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,artists,preview_url,duration_ms,uri))`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!tracksResponse.ok) {
      res.status(tracksResponse.status).json(await tracksResponse.json());
      return;
    }

    const tracksData = await tracksResponse.json();
    
    // Filter tracks that have id (we need all tracks now, not just those with preview_url)
    const availableTracks = tracksData.items
      ?.filter((item: any) => item.track?.id)
      ?.map((item: any) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists?.[0]?.name || 'Unknown Artist',
        preview_url: item.track.preview_url,
        duration_ms: item.track.duration_ms,
        uri: item.track.uri
      })) || [];

    if (availableTracks.length === 0) {
      res.status(404).json({ error: "No se encontraron canciones en esta playlist" });
      return;
    }

    // Select random track
    const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    
    res.json(randomTrack);
  } catch (err: any) {
    res.status(500).json({
      error: "Error al obtener canción aleatoria de la playlist",
      details: err.message,
    });
  }
});

guessRouter.get("/devices", async (req: Request, res: Response) => {
  const { access_token } = req.query;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  try {
    const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData);
    }
  } catch (err: any) {
    res.status(500).json({
      error: "Error al obtener dispositivos de Spotify",
      details: err.message,
    });
  }
});

guessRouter.post("/play", async (req: Request, res: Response) => {
  const { access_token } = req.query;
  const { track_uri, device_id } = req.body;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  if (!track_uri) {
    res.status(400).json({ error: "Falta track_uri" });
    return;
  }

  try {
    const url = device_id 
      ? `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`
      : "https://api.spotify.com/v1/me/player/play";

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [track_uri]
      }),
    });

    if (response.ok || response.status === 204) {
      res.json({ success: true });
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData);
    }
  } catch (err: any) {
    res.status(500).json({
      error: "Error al reproducir canción en Spotify",
      details: err.message,
    });
  }
});

guessRouter.post("/pause", async (req: Request, res: Response) => {
  const { access_token } = req.query;
  const { device_id } = req.body;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  try {
    const url = device_id 
      ? `https://api.spotify.com/v1/me/player/pause?device_id=${device_id}`
      : "https://api.spotify.com/v1/me/player/pause";

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (response.ok || response.status === 204) {
      res.json({ success: true });
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData);
    }
  } catch (err: any) {
    res.status(500).json({
      error: "Error al pausar reproducción en Spotify",
      details: err.message,
    });
  }
});

guessRouter.get("/playlist/:playlistId/all-tracks", async (req: Request, res: Response) => {
  const { playlistId } = req.params;
  const { access_token } = req.query;

  if (!access_token) {
    res.status(400).json({ error: "Falta access_token" });
    return;
  }

  if (!playlistId) {
    res.status(400).json({ error: "Falta playlistId" });
    return;
  }

  try {
    // Get all playlist tracks with pagination to get complete list
    let allTracks: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,uri)),total`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      if (!tracksResponse.ok) {
        res.status(tracksResponse.status).json(await tracksResponse.json());
        return;
      }

      const tracksData = await tracksResponse.json();
      const tracks = tracksData.items
        ?.filter((item: any) => item.track?.id)
        ?.map((item: any) => ({
          id: item.track.id,
          title: item.track.name,
          artist: item.track.artists?.[0]?.name || 'Unknown Artist',
          uri: item.track.uri,
          fullArtists: item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist'
        })) || [];

      allTracks = allTracks.concat(tracks);
      
      offset += limit;
      hasMore = tracksData.total > offset;
    }

    res.json({
      tracks: allTracks,
      total: allTracks.length,
      playlistId: playlistId,
      cachedAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Error al obtener todas las canciones de la playlist",
      details: err.message,
    });
  }
});


