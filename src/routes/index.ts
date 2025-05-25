// src/routes/index.ts
import { Router } from 'express';
import { publicRouter } from './public/public.routes';
import { privateRouter } from "./private/private.routes";
import { guessRouter } from './guess/guess.routes';
// Otras rutas que tengas

export const mainRouter = Router();

// Public routes
mainRouter.use('/public', publicRouter);

// Private routes
mainRouter.use('/api', privateRouter);

mainRouter.use('/guess', guessRouter);

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
