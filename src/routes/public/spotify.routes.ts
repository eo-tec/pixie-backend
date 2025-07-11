// src/routes/spotify.routes.ts
import { Router, Request, Response } from 'express';
import { login, callback, cover64x64, idPlaying, me, saveCredentials, isLogged } from '../../controllers/pixie/spotify.controller';
// (importa idPlaying, me, etc. también)


export const spotifyRouter = Router();

spotifyRouter.get('/login', login);
spotifyRouter.get('/callback', callback);
spotifyRouter.get('/cover-64x64', cover64x64);
spotifyRouter.get('/id-playing', idPlaying);
spotifyRouter.get('/me', me);
spotifyRouter.post('/save-credentials', saveCredentials);
spotifyRouter.get('/is-logged', isLogged);
//spotifyRouter.get('/callback', exchangeCode);

spotifyRouter.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});
// ... etc.
