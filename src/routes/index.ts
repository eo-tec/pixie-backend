// src/routes/index.ts
import { Router } from 'express';
import { spotifyRouter } from './spotify.routes';
import { photosRouter } from './photos.routes';
import { versionRouter } from './version.routes';
// Otras rutas que tengas

export const mainRouter = Router();

mainRouter.use('/spotify', spotifyRouter);
mainRouter.use('/photo', photosRouter);
mainRouter.use('/version', versionRouter);

