import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";

export async function blockUser(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const blockedId = parseInt(req.params.id as string);

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!blockedId || isNaN(blockedId)) {
    res.status(400).json({ error: "ID de usuario inválido" });
    return;
  }

  if (userId === blockedId) {
    res.status(400).json({ error: "No puedes bloquearte a ti mismo" });
    return;
  }

  try {
    // Check target user exists
    const targetUser = await prisma.public_users.findFirst({
      where: { id: blockedId, deleted_at: null },
    });

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Create block
      await tx.user_blocks.upsert({
        where: {
          blocker_id_blocked_id: { blocker_id: userId, blocked_id: blockedId },
        },
        update: {},
        create: { blocker_id: userId, blocked_id: blockedId },
      });

      // Remove friendship if exists (both directions)
      await tx.friends.deleteMany({
        where: {
          OR: [
            { user_id_1: userId, user_id_2: blockedId },
            { user_id_1: blockedId, user_id_2: userId },
          ],
        },
      });
    });

    res.status(200).json({ message: "Usuario bloqueado" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ error: "Error al bloquear usuario" });
  }
}

export async function unblockUser(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const blockedId = parseInt(req.params.id as string);

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!blockedId || isNaN(blockedId)) {
    res.status(400).json({ error: "ID de usuario inválido" });
    return;
  }

  try {
    await prisma.user_blocks.deleteMany({
      where: { blocker_id: userId, blocked_id: blockedId },
    });

    res.status(200).json({ message: "Usuario desbloqueado" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ error: "Error al desbloquear usuario" });
  }
}

export async function getBlockedUsers(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  try {
    const blocks = await prisma.user_blocks.findMany({
      where: { blocker_id: userId },
      include: {
        blocked: {
          select: { id: true, username: true, picture: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const users = blocks.map((b) => b.blocked);
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error getting blocked users:", error);
    res.status(500).json({ error: "Error al obtener usuarios bloqueados" });
  }
}
