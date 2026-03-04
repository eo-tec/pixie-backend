// src/routes/index.ts
import { Router, Request, Response } from 'express';
import { publicRouter } from './public/public.routes';
import { privateRouter } from "./private/private.routes";
import { guessRouter } from './guess/guess.routes';
import { adminRouter } from './admin/admin.routes';
import { downloadFile } from '../minio/minio';
// Otras rutas que tengas

export const mainRouter = Router();

// Dev-only: photo proxy without auth (iOS Image component doesn't send headers over HTTP)
if (process.env.NODE_ENV === 'development') {
  mainRouter.get('/api/photo/file/*', async (req: Request, res: Response) => {
    const filePath = (req.params as any)[0];
    if (!filePath) return res.status(400).send('Missing file path');
    try {
      const stream = await downloadFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      stream.pipe(res);
    } catch (err) {
      res.status(404).send('File not found');
    }
  });
}

// Public routes
mainRouter.use('/public', publicRouter);

// Private routes
mainRouter.use('/api', privateRouter);

mainRouter.use('/guess', guessRouter);

mainRouter.use('/admin', adminRouter);

mainRouter.get('/', (req, res) => {
  res.send('Hello, world!');
});


mainRouter.get('/test', (req, res) => {
  res.send('Hello, world!');
});
 
// Health check route
mainRouter.get('/health', (req, res) => {
  res.status(200).send('OK');
});
