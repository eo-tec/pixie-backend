import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";
import { Response } from "express";
import { User } from "../../types/frontTypes";
import { cleanUsername } from "../../utils/string-utils";

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

  try {
    // Limpiar y validar el username
    const cleanedUsername = cleanUsername(username);
    
    // Comprobar si el usuario ya existe
    const user = await prisma.public_users.findFirst({
      where: { user_id }
    });

    if (user) {
      res.status(400).json({ error: "Usuario ya existe" });
      return;
    }

    const userName = await prisma.public_users.findFirst({
      where: { username: cleanedUsername }
    });

    if (userName) {
      res.status(400).json({ error: "Nombre de usuario ya existe" });
      return;
    }
    
    // Crear un nuevo usuario
    const newUser = await prisma.public_users.create({
      data: { username: cleanedUsername, user_id }
    });

    res.json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
};

export const getUserPhotos = async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.params;
  const currentUserId = req.user?.id;
  
  if (!currentUserId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!username) {
    res.status(400).json({ error: "Nombre de usuario no proporcionado" });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const skip = (page - 1) * pageSize;

  try {
    // First, find the user by username
    const targetUser = await prisma.public_users.findFirst({
      where: { username }
    });

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // Get photos created by the target user that are visible to the current user
    const photos = await prisma.photos.findMany({
      skip: skip,
      take: pageSize,
      where: {
        deleted_at: null,
        user_id: targetUser.id,
        OR: [
          // Photos explicitly shared with the current user
          {
            visible_by: {
              some: {
                user_id: currentUserId
              }
            }
          },
          // If the target user is the current user, show all their photos
          {
            user_id: currentUserId
          }
        ]
      },
      select: {
        id: true,
        created_at: true,
        photo_url: true,
        username: true,
        title: true,
        user_id: true
      },
      orderBy: {
        created_at: "desc"
      }
    });

    const totalPhotos = await prisma.photos.count({
      where: {
        deleted_at: null,
        user_id: targetUser.id,
        OR: [
          {
            visible_by: {
              some: {
                user_id: currentUserId
              }
            }
          },
          {
            user_id: currentUserId
          }
        ]
      }
    });

    // Format photos to match PhotoResponse type
    const formattedPhotos = photos.map(photo => ({
      id: photo.id,
      photo_url: photo.photo_url || '',
      created_at: photo.created_at.toISOString(),
      user_id: photo.user_id?.toString() || '',
      username: photo.username || '',
      title: photo.title || ''
    }));

    res.status(200).json({
      photos: formattedPhotos,
      totalPhotos,
      totalPages: Math.ceil(totalPhotos / pageSize),
      currentPage: page
    });
  } catch (err) {
    console.error("/users/:username/photos error:", err);
    res.status(500).send("Error al obtener las fotos del usuario.");
  }
};
