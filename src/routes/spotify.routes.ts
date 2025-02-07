// src/routes/spotify.routes.ts
import { Router, Request, Response } from 'express';
import { login, callback, cover64x64, idPlaying, me } from '../controllers/spotify.controller';
// (importa idPlaying, me, etc. también)


export const spotifyRouter = Router();

spotifyRouter.get('/login', login);
spotifyRouter.get('/callback', callback);
spotifyRouter.get('/cover-64x64', cover64x64);
spotifyRouter.get('/id-playing', idPlaying);
spotifyRouter.get('/me', me);
// ... etc.
