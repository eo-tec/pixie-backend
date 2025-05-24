// routes/spotify.js (o donde prefieras)
import express, { Request, Response, Router } from "express";
import fetch from "node-fetch";
const guessRouter = Router();

const CLIENT_ID = "335726d82b904d43b50a3bd69a7d2cbe";
const CLIENT_SECRET = "9d3264ea82774c7cafe7da3be2cff4bc";

guessRouter.post("/token", async (req: Request, res: Response) => {
  const { code, code_verifier, redirect_uri } = req.body;

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
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
    res.status(response.ok ? 200 : 400).json(data);
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
    const response = await fetch("https://api.spotify.com/v1/me/playlists", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
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

export default guessRouter;
