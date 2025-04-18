// src/routes/index.ts
import { Router } from 'express';
import { getPhotosFromUser, postPhoto } from '../../controllers/app/photos.controller';
import { verifyAuth } from './checkUser';
import { Request, Response } from 'express';
import { getUser, getFriends } from '../../controllers/app/user.controller';
import { getPixies, setPixie, showPhoto } from '../../controllers/app/pixie.controller';
import { friendsRouter } from './friends.routes';
import { usersRouter } from './users.routes';
// Otras rutas que tengas

export const privateRouter = Router();

privateRouter.use(verifyAuth);   

privateRouter.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

privateRouter.get('/photos-by-user', getPhotosFromUser);
privateRouter.post('/post-photo', postPhoto);

privateRouter.get('/me', getUser);
//privateRouter.get('/friends', getFriends);

privateRouter.get('/pixies', getPixies);
privateRouter.get('/pixie/photo/:id', showPhoto);
privateRouter.post('/pixie', setPixie);

privateRouter.use('/friends', friendsRouter);

privateRouter.use('/users', usersRouter);
