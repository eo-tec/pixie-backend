// src/routes/photos.routes.ts
import { Router } from 'express';
import { getPhoto, getPhotoBinary } from '../../controllers/pixie/photos.controller';
import { checkBucket } from '../../minio/minio';
export const photosRouter = Router();

photosRouter.get('/get-photo-url', getPhoto);
photosRouter.get('/get-photo', getPhoto);
photosRouter.get('/get-photo-binary', getPhotoBinary);
photosRouter.get('/check-bucket', checkBucket);
