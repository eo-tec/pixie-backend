// src/routes/photos.routes.ts
import { Router } from 'express';
import { getPhoto, getPhotoBinary, postPublicPhoto, getPhotoByPixie } from '../../controllers/pixie/photos.controller';
import { checkBucket, downloadFile } from '../../minio/minio';
export const photosRouter = Router();

photosRouter.get('/get-photo-url', getPhoto);
photosRouter.get('/get-photo-json', getPhoto);
photosRouter.get('/get-photo', getPhotoBinary);
photosRouter.get('/get-photo-by-pixie', getPhotoByPixie);
photosRouter.post('/upload-public-photo', postPublicPhoto);
photosRouter.get('/check-bucket', checkBucket);

// Proxy endpoint to serve photos from Minio using server credentials
photosRouter.get('/file/*', async (req, res) => {
  const filePath = req.params[0];
  if (!filePath) {
    return res.status(400).send('Missing file path');
  }
  try {
    const stream = await downloadFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    res.status(404).send('File not found');
  }
});
