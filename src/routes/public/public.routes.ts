// src/routes/index.ts
import { Router } from 'express';
import { spotifyRouter } from './spotify.routes';
import { photosRouter } from './photos.routes';
import { versionRouter } from './version.routes';
import { pixieRouter } from './pixie.routes';
import { newUser } from '../../controllers/pixie/newUser.controller';

export const publicRouter = Router();

publicRouter.use('/spotify', spotifyRouter);
publicRouter.use('/photo', photosRouter);
publicRouter.use('/version', versionRouter);
publicRouter.use('/pixie', pixieRouter);
publicRouter.put('/new-user', newUser);
publicRouter.get('/', (req, res) => {
  res.send('Hello, world!');
});

