// src/routes/index.ts
import { Router } from 'express';
import { getPhotosFromUser, postPhoto, deletePhoto, getPhotoVisibility, updatePhotoVisibility } from '../../controllers/app/photos.controller';
import { verifyAuth } from './checkUser';
import { Request, Response } from 'express';
import { getUser, getFriends } from '../../controllers/app/user.controller';
import { getPixies, setPixie, showPhoto, activatePixie, resetPixie } from '../../controllers/app/pixie.controller';
import { friendsRouter } from './friends.routes';
import { usersRouter } from './users.routes';
import { drawingRouter } from './drawing.routes';
import { pixiesRouter } from './pixies.routes';
// Otras rutas que tengas

export const privateRouter = Router();

privateRouter.use(verifyAuth);   

privateRouter.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

privateRouter.get('/photos-by-user', getPhotosFromUser);
privateRouter.post('/post-photo', postPhoto);
privateRouter.delete('/photo/:id', deletePhoto);
privateRouter.get('/photo/:id/visibility', getPhotoVisibility);
privateRouter.put('/photo/:id/visibility', updatePhotoVisibility);

privateRouter.get('/me', getUser);
//privateRouter.get('/friends', getFriends);

privateRouter.get('/pixie/photo/:id', showPhoto);
privateRouter.post('/pixie', setPixie);
privateRouter.post('/pixie/activate', activatePixie);
privateRouter.post('/pixie/reset/:id', resetPixie);

//privateRouter.get('/spotify/callback', exchangeCode);

privateRouter.use('/friends', friendsRouter);

privateRouter.use('/users', usersRouter);

// Pixies routes
privateRouter.use('/pixies', pixiesRouter);

// Drawing routes
privateRouter.use('/', drawingRouter);
