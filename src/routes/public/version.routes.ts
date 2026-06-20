// src/routes/spotify.routes.ts
import { Router } from 'express';
import { getLatestVersion } from '../../controllers/pixie/versions.controller';
import { getAppVersionConfig } from '../../controllers/app/appConfig.controller';
// (importa idPlaying, me, etc. también)


export const versionRouter = Router();

versionRouter.get('/latest', getLatestVersion);
versionRouter.get('/app', getAppVersionConfig);
