import { Router } from "express";
import {
  getPhotoComments,
  addComment,
  deleteComment,
} from "../../controllers/app/comments.controller";

export const commentsRouter = Router();

// GET /photos/:photoId/comments - Get paginated comments for a photo
commentsRouter.get("/:photoId/comments", getPhotoComments);

// POST /photos/:photoId/comments - Add a comment
commentsRouter.post("/:photoId/comments", addComment);

// DELETE /photos/:photoId/comments/:commentId - Delete a comment
commentsRouter.delete("/:photoId/comments/:commentId", deleteComment);
