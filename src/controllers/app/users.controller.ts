import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";
import { Response } from "express";
import { User } from "../../types/frontTypes";

export const searchUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.params;
  const id = req.user?.id;
  console.log("🔐 searchUsers", id);
  if (!username) {
    res.status(400).json({ error: "Nombre de usuario no proporcionado" });
    return;
  }

  if (!req.user?.id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  const users = await prisma.public_users.findMany({
    where: { username: { contains: username, mode: "insensitive" } },
  });

  // Obtener todas las relaciones de amistad relevantes
  const friendships = await prisma.friends.findMany({
    where: {
      OR: [
        { user_id_1: req.user.id },
        { user_id_2: req.user.id }
      ]
    }
  });

  const usersWithStatus = users.map((user) => {
    // Buscar si existe una relación de amistad
    const friendship = friendships.find(
      (f) => (f.user_id_1 === user.id || f.user_id_2 === user.id)
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        picture: user.picture,
      },
      status: friendship ? friendship.status : null
    };
  });

  res.json(usersWithStatus);
};

export const newUser = async (req: AuthenticatedRequest, res: Response) => {
  const { username, user_id } = req.body;
  const id = req.user?.id;
  console.log("🔐 newUser", id);
  if (!username || !user_id) {
    res.status(400).json({ error: "Nombre de usuario o correo electrónico no proporcionado" });
    return;
  }

  // Comprobar si el usuario ya existe
  const user = await prisma.public_users.findFirst({
    where: { user_id }
  });

  if (user) {
    res.status(400).json({ error: "Usuario ya existe" });
    return;
  }

  const userName = await prisma.public_users.findFirst({
    where: { username }
  });

  if (userName) {
    res.status(400).json({ error: "Nombre de usuario ya existe" });
    return;
  }
  // Crear un nuevo usuario
  const newUser = await prisma.public_users.create({
    data: { username, user_id }
  });

  res.json(newUser);
};
