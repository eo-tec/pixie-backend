// src/routes/photos.routes.ts
import { Router } from 'express';
import { getPhoto } from '../../controllers/pixie/photos.controller';

export const photosRouter = Router();

photosRouter.get('/get-photo-url', getPhoto);
photosRouter.get('/get-photo', getPhoto);
