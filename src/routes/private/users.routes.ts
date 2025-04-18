import { Router } from "express";
import { searchUsers } from "../../controllers/app/users.controller";

export const usersRouter = Router();

usersRouter.get('/search/:username', searchUsers);
