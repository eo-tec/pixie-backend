import { Router } from "express";
import { newUser, searchUsers, getUserPhotos } from "../../controllers/app/users.controller";

export const usersRouter = Router();

usersRouter.get('/search/:username', searchUsers);

usersRouter.get('/:username/photos', getUserPhotos);

usersRouter.put('/new', newUser);
