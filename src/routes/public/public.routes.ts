// src/routes/index.ts
import { Router } from 'express';
import { spotifyRouter } from './spotify.routes';
import { photosRouter } from './photos.routes';
import { versionRouter } from './version.routes';
import { pixieRouter } from './pixie.routes';
// Otras rutas que tengas

export const publicRouter = Router();

publicRouter.use('/spotify', spotifyRouter);
publicRouter.use('/photo', photosRouter);
publicRouter.use('/version', versionRouter);
publicRouter.use('/pixie', pixieRouter);

