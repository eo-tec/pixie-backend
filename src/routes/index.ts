// src/routes/index.ts
import { Router } from 'express';
import { publicRouter } from './public/public.routes';
import { privateRouter } from "./private/private.routes";
// Otras rutas que tengas

export const mainRouter = Router();

// Public routes
mainRouter.use('/public', publicRouter);

// Private routes
mainRouter.use('/api', privateRouter);

mainRouter.get('/', (req, res) => {
  res.send('Hello, world!');
});

