// src/routes/photos.routes.ts
import { Router } from 'express';
import { getPhotoUrl, getPhoto } from '../controllers/photos.controller';

export const photosRouter = Router();

photosRouter.get('/get-photo-url', getPhotoUrl);
photosRouter.get('/get-photo', getPhoto);
