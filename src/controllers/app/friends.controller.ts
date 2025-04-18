import prisma from "../../services/prisma";
import { Request, Response } from "express";
import { FriendStatus } from "@prisma/client";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import { Friend } from "../../types/frontTypes";




export const getFriend = async (req: Request, res: Response) => {
  const { id } = req.params;
  const friend = await prisma.friends.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(friend);
};

export const getFriends = async (req: AuthenticatedRequest, res: Response) => {
  console.log("Asking for friends");
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friends = await prisma.friends.findMany({
    where: {
      OR: [{ user_id_1: id }, { user_id_2: id }],
      status: FriendStatus.accepted,
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const friendsWithStatus = friends.map((friend) => ({
    status: friend.status,
    user: {
      id: friend.user1.id === id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === id ? friend.user2.picture : friend.user1.picture,
    },
  }));
  console.log("Friends with status", friendsWithStatus);
  res.json(friendsWithStatus as Friend[]);
};

export const acceptFriend = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!req.user?.id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.update({
    where: { id: parseInt(id) },
    data: { status: FriendStatus.accepted },
    include: {
      user1: true,
      user2: true,
    },
  });
  const friendWithStatus = {
    status: friend.status,
    user: {
      id: friend.user1.id === req.user?.id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === req.user?.id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === req.user?.id ? friend.user2.picture : friend.user1.picture,
    },
  };
  res.json(friendWithStatus as Friend);
};

export const declineFriend = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!req.user?.id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.update({
    where: { id: parseInt(id) },
    data: { status: FriendStatus.canceled },
    include: {
      user1: true,
      user2: true,
    },
  });
  const friendWithStatus = {
    status: friend.status,
    user: {
      id: friend.user1.id === req.user?.id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === req.user?.id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === req.user?.id ? friend.user2.picture : friend.user1.picture,
    },
  };
  res.json(friendWithStatus as Friend);
};

export const addFriend = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!req.user?.id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.create({
    data: {
      user_id_1: req.user?.id,
      user_id_2: parseInt(id),
      status: FriendStatus.pending,
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const friendWithStatus = {
    status: friend.status,
    user: {
      id: friend.user2.id,
      username: friend.user2.username,
      picture: friend.user2.picture,
    },
  };
  res.json(friendWithStatus as Friend);
};

export const deleteFriend = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!req.user?.id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.delete({
    where: { id: parseInt(id) },
    include: {
      user1: true,
      user2: true,
    },
  });
  const friendWithStatus = {
    status: friend.status,
    user: {
      id: friend.user1.id === req.user?.id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === req.user?.id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === req.user?.id ? friend.user2.picture : friend.user1.picture,
    },
  };
  res.json(friendWithStatus as Friend);
};

export const getPendingFriends = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friends = await prisma.friends.findMany({
    where: {
      status: FriendStatus.pending,
      user_id_2: id,
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const friendsWithStatus = friends.map((friend) => ({
    status: friend.status,
    user: {
      id: friend.user1.id === req.user?.id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === req.user?.id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === req.user?.id ? friend.user2.picture : friend.user1.picture,
    },
  }));
  res.json(friendsWithStatus as Friend[]);
};
