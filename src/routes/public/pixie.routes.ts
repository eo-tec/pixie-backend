// src/routes/spotify.routes.ts
import { Router } from 'express';
import { addPixie } from '../../controllers/pixie/pixie.controller';
// (importa idPlaying, me, etc. también)

export const pixieRouter = Router();

pixieRouter.post('/add', addPixie);
