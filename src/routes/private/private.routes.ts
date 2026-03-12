// src/routes/index.ts
import { Router } from 'express';
import { getPhotosFromUser, postPhoto, deletePhoto, getPhotoVisibility, updatePhotoVisibility, hidePhoto } from '../../controllers/app/photos.controller';
import { verifyAuth, AuthenticatedRequest } from './checkUser';
import { Request, Response } from 'express';
import { getUser, getFriends, updateProfile, updateTimezone, deleteAccount, acceptTerms } from '../../controllers/app/user.controller';
import { blockUser, unblockUser, getBlockedUsers } from '../../controllers/app/blocks.controller';
import { createReport } from '../../controllers/app/reports.controller';
import { getPixies, setPixie, showPhoto, activatePixie, resetPixie } from '../../controllers/app/pixie.controller';
import { friendsRouter } from './friends.routes';
import { usersRouter } from './users.routes';
import { drawingRouter } from './drawing.routes';
import { pixiesRouter } from './pixies.routes';
import { reactionsRouter } from './reactions.routes';
import { commentsRouter } from './comments.routes';
import { playlistRouter } from './playlist.routes';
import { downloadFile } from '../../minio/minio';
import prisma from '../../services/prisma';

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
privateRouter.post('/photo/:id/hide', hidePhoto);

privateRouter.get('/me', getUser);
privateRouter.put('/me', updateProfile);
privateRouter.delete('/me', deleteAccount);
privateRouter.patch('/me/timezone', updateTimezone);
privateRouter.post('/me/accept-terms', acceptTerms);

// Block/unblock users
privateRouter.post('/user/:id/block', blockUser);
privateRouter.delete('/user/:id/block', unblockUser);
privateRouter.get('/user/blocked', getBlockedUsers);

// Reports
privateRouter.post('/report', createReport);
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
privateRouter.use('/pixies', playlistRouter);

// Drawing routes
privateRouter.use('/', drawingRouter);

// Reactions and comments routes
privateRouter.use('/photos', reactionsRouter);
privateRouter.use('/photos', commentsRouter);

// Photo file proxy - serves photos from Minio after verifying access
privateRouter.get('/photo/file/*', async (req: AuthenticatedRequest, res: Response) => {
  const filePath = (req.params as any)[0];
  if (!filePath || !req.user) {
    return res.status(400).send('Missing file path');
  }

  try {
    // Find the photo by its url
    const photo = await prisma.photos.findFirst({
      where: { photo_url: filePath, deleted_at: null },
      select: { id: true, user_id: true, is_public: true },
    });

    if (!photo) {
      return res.status(404).send('Photo not found');
    }

    const userId = req.user.id;
    const photoOwnerId = photo.user_id;

    // 1. Photo belongs to the user
    if (photoOwnerId === userId) {
      // Access granted
    }
    // Photo has no owner — deny
    else if (photoOwnerId === null) {
      return res.status(403).send('Access denied');
    }
    // 2. Photo is in photo_visible_by_users for this user
    else {
      const visible = await prisma.photo_visible_by_users.findFirst({
        where: { photo_id: photo.id, user_id: userId },
      });

      if (visible) {
        // Access granted
      }
      // 3. Photo is public AND belongs to a friend
      else if (photo.is_public) {
        const friendship = await prisma.friends.findFirst({
          where: {
            status: 'accepted',
            OR: [
              { user_id_1: userId, user_id_2: photoOwnerId },
              { user_id_1: photoOwnerId, user_id_2: userId },
            ],
          },
        });

        if (!friendship) {
          return res.status(403).send('Access denied');
        }
      } else {
        return res.status(403).send('Access denied');
      }
    }

    // Stream the file from Minio
    const stream = await downloadFile(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    stream.pipe(res);
  } catch (err) {
    res.status(404).send('File not found');
  }
});
