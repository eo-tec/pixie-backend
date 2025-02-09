// src/routes/spotify.routes.ts
import { Router } from 'express';
import { getLatestVersion } from '../controllers/versions.controller';
// (importa idPlaying, me, etc. también)


export const versionRouter = Router();

versionRouter.get('/latest', getLatestVersion);
