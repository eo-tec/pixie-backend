import prisma from "../../services/prisma";
import { Request, Response } from "express";
import { FriendStatus } from "@prisma/client";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import { Friend, PaginatedFriendsResponse } from "../../types/frontTypes";




export const getFriend = async (req: Request, res: Response) => {
  const { id } = req.params;
  const friend = await prisma.friends.findUnique({
    where: { id: parseInt(id) },
  });
  res.json(friend);
};

export const getFriends = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.user?.id;

  if (!id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const whereClause = {
    OR: [
      {
        AND: [
          { OR: [{ user_id_1: id }, { user_id_2: id }] },
          { status: FriendStatus.accepted }
        ]
      },
      {
        AND: [
          { user_id_2: id },
          { status: FriendStatus.pending }
        ]
      }
    ]
  };

  const [friends, total] = await Promise.all([
    prisma.friends.findMany({
      where: whereClause,
      include: {
        user1: true,
        user2: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.friends.count({ where: whereClause }),
  ]);

  const friendsWithStatus = friends.map((friend) => ({
    status: friend.status,
    user: {
      id: friend.user1.id === id ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === id ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === id ? friend.user2.picture : friend.user1.picture,
    },
  }));

  const response: PaginatedFriendsResponse = {
    data: friendsWithStatus as Friend[],
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };

  res.json(response);
};

export const acceptFriend = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.update({
    where: { user_id_1_user_id_2: { user_id_1: parseInt(id), user_id_2: userId } },
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
  const userId = req.user?.id;

  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "ID de usuario no proporcionado" });
    return;
  }
  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }
  const friend = await prisma.friends.update({
    where: { user_id_1_user_id_2: { user_id_1: parseInt(id), user_id_2: userId } },
    data: { status: FriendStatus.canceled },
    include: {
      user1: true,
      user2: true,
    },
  });
  const friendWithStatus = {
    status: friend.status,
    user: {
      id: friend.user1.id === userId ? friend.user2.id : friend.user1.id,
      username: friend.user1.id === userId ? friend.user2.username : friend.user1.username,
      picture: friend.user1.id === userId ? friend.user2.picture : friend.user1.picture,
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
