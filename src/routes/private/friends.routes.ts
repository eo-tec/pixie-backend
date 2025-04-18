import { Router } from "express";
import { acceptFriend, addFriend, declineFriend, deleteFriend, getFriend, getFriends, getPendingFriends } from "../../controllers/app/friends.controller";

export const friendsRouter = Router();

friendsRouter.get('/', getFriends);

friendsRouter.get('/:id', getFriend);

friendsRouter.post('/add/:id', addFriend);
friendsRouter.post('/accept/:id', acceptFriend);
friendsRouter.post('/decline/:id', declineFriend);

friendsRouter.delete('/delete/:id', deleteFriend);

friendsRouter.get('/pending/:id', getPendingFriends);
