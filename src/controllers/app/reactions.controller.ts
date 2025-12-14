import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import { ReactionType } from "@prisma/client";
import prisma from "../../services/prisma";

interface ReactionSummary {
  type: ReactionType;
  count: number;
}

interface PhotoReactionsResponse {
  reactions: ReactionSummary[];
  userReaction: ReactionType | null;
  totalCount: number;
}

export async function getPhotoReactions(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.user?.id;
  const { photoId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  try {
    // Get all reactions for this photo
    const reactions = await prisma.photo_reactions.findMany({
      where: { photo_id: parseInt(photoId) },
      select: {
        type: true,
        user_id: true,
      },
    });

    // Group by type
    const reactionsByType = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.type]) {
        acc[reaction.type] = { type: reaction.type, count: 0 };
      }
      acc[reaction.type].count++;
      return acc;
    }, {} as Record<ReactionType, ReactionSummary>);

    // Find user's reaction
    const userReaction = reactions.find((r) => r.user_id === userId);

    const response: PhotoReactionsResponse = {
      reactions: Object.values(reactionsByType),
      userReaction: userReaction?.type || null,
      totalCount: reactions.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting reactions:", error);
    res.status(500).json({ error: "Error al obtener reacciones" });
  }
}

export async function addReaction(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { photoId } = req.params;
  const { type } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  const validTypes: ReactionType[] = ["like", "laugh", "wow", "sad"];
  if (!type || !validTypes.includes(type)) {
    res.status(400).json({ error: "Tipo de reaccion invalido" });
    return;
  }

  try {
    // Verify photo exists and user can see it
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

    // Upsert: create or update the reaction
    const reaction = await prisma.photo_reactions.upsert({
      where: {
        photo_id_user_id: {
          photo_id: parseInt(photoId),
          user_id: userId,
        },
      },
      update: { type },
      create: {
        photo_id: parseInt(photoId),
        user_id: userId,
        type,
      },
    });

    res.status(200).json(reaction);
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ error: "Error al agregar reaccion" });
  }
}

export async function removeReaction(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { photoId } = req.params;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!photoId) {
    res.status(400).json({ error: "Se requiere el id de la foto" });
    return;
  }

  try {
    await prisma.photo_reactions.delete({
      where: {
        photo_id_user_id: {
          photo_id: parseInt(photoId),
          user_id: userId,
        },
      },
    });

    res.status(200).json({ message: "Reaccion eliminada" });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({ error: "Error al eliminar reaccion" });
  }
}
