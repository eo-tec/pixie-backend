// src/routes/photos.routes.ts
import { Router } from 'express';
import { getPhoto, getPhotoBinary, postPublicPhoto, getPhotoByPixie } from '../../controllers/pixie/photos.controller';
import { checkBucket } from '../../minio/minio';
export const photosRouter = Router();

photosRouter.get('/get-photo-url', getPhoto);
photosRouter.get('/get-photo-json', getPhoto);
photosRouter.get('/get-photo', getPhotoBinary);
photosRouter.get('/get-photo-by-pixie', getPhotoByPixie);
photosRouter.post('/upload-public-photo', postPublicPhoto);
photosRouter.get('/check-bucket', checkBucket);
