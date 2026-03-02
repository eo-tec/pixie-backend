import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from '../../services/prisma';
import { publishToMQTT } from '../../mqtt/client';
import { effectiveBoolean, effectivePhotos } from '../../config/tierConfig';

// Helper: send config update to frame via MQTT after playlist changes
async function notifyFramePlaylistChanged(pixieId: number) {
  const pixie = await prisma.pixie.findUnique({
    where: { id: pixieId },
    include: { users: true, playlist_items: true },
  });
  if (!pixie) return;

  const playlistLength = pixie.playlist_items?.length || pixie.pictures_on_queue || 1;
  const tier = pixie.tier;

  publishToMQTT(`frame/${pixieId}`, JSON.stringify({
    action: "update_info",
    brightness: pixie.brightness ?? 50,
    pictures_on_queue: effectivePhotos(tier, playlistLength),
    spotify_enabled: effectiveBoolean(tier, 'spotify_enabled', pixie.spotify_enabled ?? false),
    secs_between_photos: pixie.secs_between_photos ?? 30,
    code: pixie.code ?? '',
    schedule_enabled: effectiveBoolean(tier, 'schedule_enabled', pixie.schedule_enabled ?? false),
    schedule_on_hour: pixie.schedule_on_hour ?? 8,
    schedule_on_minute: pixie.schedule_on_minute ?? 0,
    schedule_off_hour: pixie.schedule_off_hour ?? 22,
    schedule_off_minute: pixie.schedule_off_minute ?? 0,
    clock_enabled: pixie.clock_enabled ?? false,
    timezone_offset: pixie.users?.timezone_offset ?? 0,
  }));
}

// Helper: ensure default playlist exists for a pixie
async function ensureDefaultPlaylist(pixieId: number) {
  const existing = await prisma.playlist_items.findMany({
    where: { pixie_id: pixieId },
  });
  if (existing.length === 0) {
    await prisma.playlist_items.create({
      data: {
        pixie_id: pixieId,
        position: 0,
        face_type: 'photos',
        locked: true,
      },
    });
    await prisma.pixie.update({
      where: { id: pixieId },
      data: { pictures_on_queue: 1 },
    });
  }
}

export const getPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  const pixieId = parseInt(req.params.pixieId as string, 10);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie invalido" });
    return;
  }

  try {
    const pixie = await prisma.pixie.findFirst({
      where: { id: pixieId, created_by: userId },
    });

    if (!pixie) {
      res.status(404).json({ error: "Pixie no encontrado" });
      return;
    }

    await ensureDefaultPlaylist(pixieId);

    const items = await prisma.playlist_items.findMany({
      where: { pixie_id: pixieId },
      orderBy: { position: 'asc' },
    });

    res.status(200).json({ items });
  } catch (error) {
    console.error("Error al obtener playlist:", error);
    res.status(500).json({ error: "Error al obtener playlist" });
  }
};

export const updatePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  const pixieId = parseInt(req.params.pixieId as string, 10);
  const userId = req.user?.id;
  const { items } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie invalido" });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Se requiere al menos un item" });
    return;
  }

  // Validate first item is locked photos
  if (items[0].face_type !== 'photos' || items[0].locked !== true) {
    res.status(400).json({ error: "El primer item debe ser fotos (bloqueado)" });
    return;
  }

  try {
    const pixie = await prisma.pixie.findFirst({
      where: { id: pixieId, created_by: userId },
    });

    if (!pixie) {
      res.status(404).json({ error: "Pixie no encontrado" });
      return;
    }

    // Transaction: delete old items, insert new ones, update pictures_on_queue
    await prisma.$transaction(async (tx) => {
      await tx.playlist_items.deleteMany({
        where: { pixie_id: pixieId },
      });

      for (let i = 0; i < items.length; i++) {
        await tx.playlist_items.create({
          data: {
            pixie_id: pixieId,
            position: i,
            face_type: items[i].face_type,
            config: items[i].config || {},
            locked: items[i].locked || false,
          },
        });
      }

      await tx.pixie.update({
        where: { id: pixieId },
        data: { pictures_on_queue: items.length },
      });
    });

    // Send MQTT update with new pictures_on_queue
    const user = pixie.created_by
      ? await prisma.public_users.findUnique({ where: { id: pixie.created_by } })
      : null;

    const updatedPixie = await prisma.pixie.findUnique({ where: { id: pixieId } });
    const updateTier = updatedPixie?.tier ?? 'premium';

    publishToMQTT(`frame/${pixieId}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie?.brightness ?? 50,
      pictures_on_queue: effectivePhotos(updateTier, items.length),
      spotify_enabled: effectiveBoolean(updateTier, 'spotify_enabled', updatedPixie?.spotify_enabled ?? false),
      secs_between_photos: updatedPixie?.secs_between_photos ?? 30,
      code: updatedPixie?.code ?? '',
      schedule_enabled: effectiveBoolean(updateTier, 'schedule_enabled', updatedPixie?.schedule_enabled ?? false),
      schedule_on_hour: updatedPixie?.schedule_on_hour ?? 8,
      schedule_on_minute: updatedPixie?.schedule_on_minute ?? 0,
      schedule_off_hour: updatedPixie?.schedule_off_hour ?? 22,
      schedule_off_minute: updatedPixie?.schedule_off_minute ?? 0,
      clock_enabled: updatedPixie?.clock_enabled ?? false,
      timezone_offset: user?.timezone_offset ?? 0,
    }));

    const newItems = await prisma.playlist_items.findMany({
      where: { pixie_id: pixieId },
      orderBy: { position: 'asc' },
    });

    res.status(200).json({ items: newItems });
  } catch (error) {
    console.error("Error al actualizar playlist:", error);
    res.status(500).json({ error: "Error al actualizar playlist" });
  }
};

export const addPlaylistItem = async (req: AuthenticatedRequest, res: Response) => {
  const pixieId = parseInt(req.params.pixieId as string, 10);
  const userId = req.user?.id;
  const { face_type, config } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie invalido" });
    return;
  }

  if (!face_type) {
    res.status(400).json({ error: "Se requiere face_type" });
    return;
  }

  try {
    const pixie = await prisma.pixie.findFirst({
      where: { id: pixieId, created_by: userId },
    });

    if (!pixie) {
      res.status(404).json({ error: "Pixie no encontrado" });
      return;
    }

    await ensureDefaultPlaylist(pixieId);

    // Get max position
    const lastItem = await prisma.playlist_items.findFirst({
      where: { pixie_id: pixieId },
      orderBy: { position: 'desc' },
    });

    const newPosition = (lastItem?.position ?? -1) + 1;

    const item = await prisma.playlist_items.create({
      data: {
        pixie_id: pixieId,
        position: newPosition,
        face_type,
        config: config || {},
      },
    });

    // Update pictures_on_queue
    const totalItems = await prisma.playlist_items.count({
      where: { pixie_id: pixieId },
    });

    await prisma.pixie.update({
      where: { id: pixieId },
      data: { pictures_on_queue: totalItems },
    });

    // Notify frame about updated playlist
    await notifyFramePlaylistChanged(pixieId);

    res.status(201).json({ item });
  } catch (error) {
    console.error("Error al agregar item a playlist:", error);
    res.status(500).json({ error: "Error al agregar item" });
  }
};

export const deletePlaylistItem = async (req: AuthenticatedRequest, res: Response) => {
  const pixieId = parseInt(req.params.pixieId as string, 10);
  const itemId = parseInt(req.params.itemId as string, 10);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (isNaN(pixieId) || isNaN(itemId)) {
    res.status(400).json({ error: "IDs invalidos" });
    return;
  }

  try {
    const item = await prisma.playlist_items.findFirst({
      where: { id: itemId, pixie_id: pixieId },
      include: { pixie: true },
    });

    if (!item) {
      res.status(404).json({ error: "Item no encontrado" });
      return;
    }

    if (item.pixie.created_by !== userId) {
      res.status(403).json({ error: "No tienes permisos" });
      return;
    }

    if (item.locked) {
      res.status(400).json({ error: "No se puede eliminar un item bloqueado" });
      return;
    }

    await prisma.playlist_items.delete({
      where: { id: itemId },
    });

    // Reorder remaining items
    const remaining = await prisma.playlist_items.findMany({
      where: { pixie_id: pixieId },
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await prisma.playlist_items.update({
          where: { id: remaining[i].id },
          data: { position: i },
        });
      }
    }

    // Update pictures_on_queue
    await prisma.pixie.update({
      where: { id: pixieId },
      data: { pictures_on_queue: remaining.length },
    });

    // Notify frame about updated playlist
    await notifyFramePlaylistChanged(pixieId);

    res.status(200).json({ message: "Item eliminado" });
  } catch (error) {
    console.error("Error al eliminar item de playlist:", error);
    res.status(500).json({ error: "Error al eliminar item" });
  }
};
