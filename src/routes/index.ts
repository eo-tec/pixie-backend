// src/routes/index.ts
import { Router } from 'express';
import { spotifyRouter } from './spotify.routes';
import { photosRouter } from './photos.routes';
// Otras rutas que tengas

export const mainRouter = Router();

mainRouter.use('/spotify', spotifyRouter);
mainRouter.use('/photo', photosRouter);

