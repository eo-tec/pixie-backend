import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";

interface CommentResponse {
  id: number;
  content: string;
  created_at: Date;
  user: {
    id: number;
    username: string;
    picture: string | null;
  };
}

interface PaginatedCommentsResponse {
  comments: CommentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export async function getPhotoComments(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.user?.id;
  const { photoId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  try {
    const [comments, total] = await Promise.all([
      prisma.photo_comments.findMany({
        where: {
          photo_id: parseInt(photoId),
          deleted_at: null,
        },
        include: {
          user: {
            select: { id: true, username: true, picture: true },
          },
        },
        orderBy: { created_at: "asc" },
        skip,
        take: limit,
      }),
      prisma.photo_comments.count({
        where: {
          photo_id: parseInt(photoId),
          deleted_at: null,
        },
      }),
    ]);

    const response: PaginatedCommentsResponse = {
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: {
          id: c.user.id,
          username: c.user.username,
          picture: c.user.picture,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({ error: "Error al obtener comentarios" });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { photoId } = req.params;
  const { content } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "El comentario no puede estar vacio" });
    return;
  }

  if (content.length > 500) {
    res.status(400).json({ error: "El comentario es demasiado largo (max 500 caracteres)" });
    return;
  }

  try {
    // Verify photo exists
    const photo = await prisma.photos.findFirst({
      where: {
        id: parseInt(photoId),
        deleted_at: null,
      },
    });

    if (!photo) {
      res.status(404).json({ error: "Foto no encontrada" });
      return;
    }

    const comment = await prisma.photo_comments.create({
      data: {
        photo_id: parseInt(photoId),
        user_id: userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, username: true, picture: true },
        },
      },
    });

    const response: CommentResponse = {
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        picture: comment.user.picture,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Error al agregar comentario" });
  }
}

export async function deleteComment(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { photoId, commentId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId || !commentId) {
    res.status(400).json({ error: "Se requiere el id de la foto y del comentario" });
    return;
  }

  try {
    // Get comment with photo info to check permissions
    const comment = await prisma.photo_comments.findFirst({
      where: {
        id: parseInt(commentId),
        photo_id: parseInt(photoId),
        deleted_at: null,
      },
      include: {
        photo: { select: { user_id: true } },
      },
    });

    if (!comment) {
      res.status(404).json({ error: "Comentario no encontrado" });
      return;
    }

    // Only comment author or photo owner can delete
    if (comment.user_id !== userId && comment.photo.user_id !== userId) {
      res.status(403).json({ error: "No tienes permiso para eliminar este comentario" });
      return;
    }

    // Soft delete
    await prisma.photo_comments.update({
      where: { id: parseInt(commentId) },
      data: { deleted_at: new Date() },
    });

    res.status(200).json({ message: "Comentario eliminado" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
}
