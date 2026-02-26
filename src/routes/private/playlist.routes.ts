import { Router } from "express";
import { getPlaylist, updatePlaylist, addPlaylistItem, deletePlaylistItem } from "../../controllers/app/playlist.controller";

export const playlistRouter = Router();

playlistRouter.get("/:pixieId/playlist", getPlaylist);
playlistRouter.put("/:pixieId/playlist", updatePlaylist);
playlistRouter.post("/:pixieId/playlist/items", addPlaylistItem);
playlistRouter.delete("/:pixieId/playlist/items/:itemId", deletePlaylistItem);
