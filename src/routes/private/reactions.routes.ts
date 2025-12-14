import { Router } from "express";
import {
  getPhotoReactions,
  addReaction,
  removeReaction,
} from "../../controllers/app/reactions.controller";

export const reactionsRouter = Router();

// GET /photos/:photoId/reactions - Get all reactions for a photo
reactionsRouter.get("/:photoId/reactions", getPhotoReactions);

// POST /photos/:photoId/reactions - Add or update reaction
reactionsRouter.post("/:photoId/reactions", addReaction);

// DELETE /photos/:photoId/reactions - Remove user's reaction
reactionsRouter.delete("/:photoId/reactions", removeReaction);
