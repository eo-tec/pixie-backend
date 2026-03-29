// src/routes/index.ts
import { Router, Request, Response } from 'express';
import { publicRouter } from './public/public.routes';
import { privateRouter } from "./private/private.routes";
import { guessRouter } from './guess/guess.routes';
import { adminRouter } from './admin/admin.routes';
import { downloadFile, statFile, getPartialFile } from '../minio/minio';
// Otras rutas que tengas

export const mainRouter = Router();

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}

// Dev-only: photo proxy without auth (iOS Image component doesn't send headers over HTTP)
if (process.env.NODE_ENV === 'development') {
  mainRouter.get('/api/photo/file/*', async (req: Request, res: Response) => {
    const filePath = (req.params as any)[0];
    if (!filePath) return res.status(400).send('Missing file path');
    try {
      const stat = await statFile(filePath);
      const totalSize = stat.size;
      const contentType = getContentType(filePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        const stream = await getPartialFile(filePath, start, chunkSize);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.setHeader('Content-Type', contentType);
        stream.pipe(res);
      } else {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', totalSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        const stream = await downloadFile(filePath);
        stream.pipe(res);
      }
    } catch (err) {
      res.status(404).send('File not found');
    }
  });
}

// Public proxy for profile pictures (no per-photo auth needed, only serves profile-pictures/ prefix)
mainRouter.get('/api/photo/file/profile-pictures/*', async (req: Request, res: Response) => {
  const filePath = 'profile-pictures/' + (req.params as any)[0];
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
