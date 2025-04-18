import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";
import { Response } from "express";
import { User } from "../../types/frontTypes";

export const searchUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.params;
  if (!username) {
    res.status(400).json({ error: "Nombre de usuario no proporcionado" });
    return;
  }
  const users = await prisma.public_users.findMany({
    where: { username: { contains: username, mode: "insensitive" } },
  });
  const usersWithStatus = users.map((user) => ({
    id: user.id,
    username: user.username,
    picture: user.picture,
  }));
  res.json(usersWithStatus as User[]);
};
