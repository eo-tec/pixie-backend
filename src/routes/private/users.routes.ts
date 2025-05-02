import { Router } from "express";
import { newUser, searchUsers } from "../../controllers/app/users.controller";

export const usersRouter = Router();

usersRouter.get('/search/:username', searchUsers);

usersRouter.put('/new', newUser);
