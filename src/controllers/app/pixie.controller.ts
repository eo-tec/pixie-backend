import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from '../../services/prisma';
import { publishToMQTT, isFrameOnline, getFrameLastSeen } from '../../mqtt/client';
import { pixie } from "@prisma/client";
import { effectiveBoolean, effectivePhotos } from '../../config/tierConfig';

// Endpoint para verificar si un frame está registrado (usado durante provisioning BLE)
export const checkFrameRegistration = async (req: Request, res: Response) => {
  const frameToken = req.params.frameToken as string;

  if (!frameToken) {
    res.status(400).json({ error: "frameToken is required" });
    return;
  }

  try {
    // Buscar pixie por MAC (frameToken es la MAC con ":")
    const pixie = await prisma.pixie.findFirst({
      where: { mac: frameToken }
    });

    if (pixie) {
      res.status(200).json({
        registered: true,
        frameId: pixie.id
      });
    } else {
      res.status(200).json({
        registered: false
      });
    }
  } catch (error) {
    console.error("Error checking frame registration:", error);
    res.status(500).json({ error: "Error checking frame registration" });
  }
};

export const getPixies = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  try {
    const pixies = await prisma.pixie.findMany({
      where: {
        created_by: id,
      },
      include: {
        current_photo: {
          select: {
            id: true,
            title: true,
            username: true,
            photo_url: true,
          },
        },
      },
    });

    const enrichedPixies = pixies.map((p) => ({
      ...p,
      is_online: isFrameOnline(p.id),
      last_seen: getFrameLastSeen(p.id)?.toISOString() ?? null,
      current_photo: p.current_photo
        ? {
            id: p.current_photo.id,
            title: p.current_photo.title,
            author: p.current_photo.username,
            photo_url: p.current_photo.photo_url,
          }
        : null,
      current_song: p.current_song_id
        ? {
            id: p.current_song_id,
            name: p.current_song_name,
          }
        : null,
      current_photo_id: undefined,
      current_song_id: undefined,
      current_song_name: undefined,
    }));

    res.status(200).json({ pixies: enrichedPixies });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los pixies del usuario" });
  }
};

export const getPixie = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  const pixieId = parseInt(req.params.id as string, 10);
  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie inválido" });
    return;
  }

  try {
    const p = await prisma.pixie.findFirst({
      where: {
        id: pixieId,
        created_by: userId,
      },
      include: {
        current_photo: {
          select: {
            id: true,
            title: true,
            username: true,
            photo_url: true,
          },
        },
      },
    });

    if (!p) {
      res.status(404).json({ error: "Pixie no encontrado" });
      return;
    }

    const enrichedPixie = {
      ...p,
      is_online: isFrameOnline(p.id),
      last_seen: getFrameLastSeen(p.id)?.toISOString() ?? null,
      current_photo: p.current_photo
        ? {
            id: p.current_photo.id,
            title: p.current_photo.title,
            author: p.current_photo.username,
            photo_url: p.current_photo.photo_url,
          }
        : null,
      current_song: p.current_song_id
        ? {
            id: p.current_song_id,
            name: p.current_song_name,
          }
        : null,
      current_photo_id: undefined,
      current_song_id: undefined,
      current_song_name: undefined,
    };

    res.status(200).json(enrichedPixie);
  } catch (error) {
    console.error("Error al obtener pixie:", error);
    res.status(500).json({ error: "Error al obtener el pixie" });
  }
};

export const setPixie = async (req: AuthenticatedRequest, res: Response) => {
  const pixie : pixie = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!pixie.id) {
    res.status(400).json({ error: "Se requiere el id del pixie" });
    return;
  }

  const pixieId = typeof pixie.id === 'string' ? parseInt(pixie.id, 10) : pixie.id;
  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie inválido" });
    return;
  }

  try {
    // Verificar que el pixie pertenece al usuario
    const existingPixie = await prisma.pixie.findFirst({
      where: {
        id: pixieId,
      }
    });


    if (!existingPixie) {
      res.status(404).json({ error: "Pixie no encontrado o no tienes permisos" });
      return;
    }

    // Actualizar el pixie - filtrar solo campos actualizables
    const { id, created_at, created_by, mac, current_photo_id, current_song_id, current_song_name, tier, ...updateData } = pixie;
    const updatedPixie = await prisma.pixie.update({
      where: { id: pixieId },
      data: updateData
    });

    // Obtener timezone del usuario dueño del frame
    const user = existingPixie.created_by
      ? await prisma.public_users.findUnique({ where: { id: existingPixie.created_by } })
      : null;

    // Enviar mensaje MQTT con campos en el root (formato esperado por ESP32)
    const pixieTier = updatedPixie.tier;
    publishToMQTT(`frame/${existingPixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: effectivePhotos(pixieTier, updatedPixie.pictures_on_queue ?? 5),
      spotify_enabled: effectiveBoolean(pixieTier, 'spotify_enabled', updatedPixie.spotify_enabled),
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code,
      schedule_enabled: effectiveBoolean(pixieTier, 'schedule_enabled', updatedPixie.schedule_enabled),
      schedule_on_hour: updatedPixie.schedule_on_hour,
      schedule_on_minute: updatedPixie.schedule_on_minute,
      schedule_off_hour: updatedPixie.schedule_off_hour,
      schedule_off_minute: updatedPixie.schedule_off_minute,
      clock_enabled: updatedPixie.clock_enabled,
      timezone_offset: user?.timezone_offset ?? 0,
      has_owner: !!updatedPixie.created_by
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al actualizar pixie:", error);
    res.status(500).json({ error: "Error al actualizar el pixie" });
  }
};

export const showPhoto = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const pixies = await prisma.pixie.findMany({
    where: {
      created_by: req.user?.id,
    },
  });

  pixies.map((pixie) => { 
    publishToMQTT(`frame/${pixie.id}`, JSON.stringify({action: "update_photo", id}));
  });
  

  res.status(200).json({ message: "Photo shown" });
};

export const activatePixie = async (req: AuthenticatedRequest, res: Response) => {
  const { code, name } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!code) {
    res.status(400).json({ error: "Se requiere el código del pixie" });
    return;
  }

  if (!name) {
    res.status(400).json({ error: "Se requiere el nombre del pixie" });
    return;
  }

  try {
    // Buscar el pixie con el código proporcionado
    const pixie = await prisma.pixie.findFirst({
      where: {
        code: code
      }
    });

    if (!pixie) {
      res.status(404).json({ error: "No se encontró ningún pixie con ese código" });
      return;
    }

    // Actualizar el pixie con el nuevo código, nombre y el usuario
    const updatedPixie = await prisma.pixie.update({
      where: { id: pixie.id },
      data: {
        code: "0000",
        name: name,
        created_by: userId
      }
    });

    // Create default playlist if none exists
    const existingPlaylist = await prisma.playlist_items.findMany({
      where: { pixie_id: pixie.id },
    });
    if (existingPlaylist.length === 0) {
      await prisma.playlist_items.create({
        data: {
          pixie_id: pixie.id,
          position: 0,
          face_type: 'photos',
          locked: true,
        },
      });
      await prisma.pixie.update({
        where: { id: pixie.id },
        data: { pictures_on_queue: 1 },
      });
    }

    // Obtener timezone del usuario dueño del frame
    const user = await prisma.public_users.findUnique({ where: { id: userId } });

    // Enviar mensaje MQTT con campos en el root (formato esperado por ESP32)
    const activateTier = updatedPixie.tier;
    publishToMQTT(`frame/${updatedPixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: effectivePhotos(activateTier, updatedPixie.pictures_on_queue ?? 5),
      spotify_enabled: effectiveBoolean(activateTier, 'spotify_enabled', updatedPixie.spotify_enabled),
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code,
      schedule_enabled: effectiveBoolean(activateTier, 'schedule_enabled', updatedPixie.schedule_enabled),
      schedule_on_hour: updatedPixie.schedule_on_hour,
      schedule_on_minute: updatedPixie.schedule_on_minute,
      schedule_off_hour: updatedPixie.schedule_off_hour,
      schedule_off_minute: updatedPixie.schedule_off_minute,
      clock_enabled: updatedPixie.clock_enabled,
      timezone_offset: user?.timezone_offset ?? 0,
      has_owner: true
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al activar pixie:", error);
    res.status(500).json({ error: "Error al activar el pixie" });
  }
};

export const resetPixie = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  const pixieId = parseInt(id, 10);
  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie inválido" });
    return;
  }

  try {
    // Enviar mensaje MQTT para reset de fábrica
    publishToMQTT(`frame/${pixieId}`, JSON.stringify({action: "factory_reset"}));
    
    res.status(200).json({ 
      message: "Comando de reset enviado", 
      pixie_id: pixieId 
    });
  } catch (error) {
    console.error("Error al enviar comando de reset:", error);
    res.status(500).json({ error: "Error al enviar comando de reset" });
  }
};

// Registrar un frame con el usuario actual (asociar pixie al usuario)
// Acepta MAC address como identificador
export const registerFrameWithUser = async (req: AuthenticatedRequest, res: Response) => {
  const frameToken = req.params.frameToken as string;  // MAC address como "78:1C:3C:A5:B4:5C"
  const { name } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!frameToken) {
    res.status(400).json({ error: "frameToken (MAC) es requerido" });
    return;
  }

  try {
    // Buscar el pixie por MAC
    const pixie = await prisma.pixie.findFirst({
      where: { mac: frameToken }
    });

    if (!pixie) {
      res.status(404).json({ error: "Frame no encontrado" });
      return;
    }

    // Verificar que el frame no esté ya asociado a otro usuario
    if (pixie.created_by && pixie.created_by !== userId) {
      res.status(403).json({ error: "Este frame ya está asociado a otro usuario" });
      return;
    }

    // Actualizar el pixie con el usuario y nombre
    const updatedPixie = await prisma.pixie.update({
      where: { id: pixie.id },
      data: {
        created_by: userId,
        name: name || pixie.name || "Pixie"
      }
    });

    // Create default playlist if none exists
    const existingPlaylist = await prisma.playlist_items.findMany({
      where: { pixie_id: pixie.id },
    });
    if (existingPlaylist.length === 0) {
      await prisma.playlist_items.create({
        data: {
          pixie_id: pixie.id,
          position: 0,
          face_type: 'photos',
          locked: true,
        },
      });
      await prisma.pixie.update({
        where: { id: pixie.id },
        data: { pictures_on_queue: 1 },
      });
    }

    console.log(`[Pixie] Frame ${pixie.id} (MAC: ${frameToken}) registrado con usuario ${userId}`);

    // Obtener timezone del usuario dueño del frame
    const user = await prisma.public_users.findUnique({ where: { id: userId } });

    // Enviar config al frame via MQTT
    const registerTier = updatedPixie.tier;
    publishToMQTT(`frame/${pixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: effectivePhotos(registerTier, updatedPixie.pictures_on_queue ?? 5),
      spotify_enabled: effectiveBoolean(registerTier, 'spotify_enabled', updatedPixie.spotify_enabled),
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code,
      schedule_enabled: effectiveBoolean(registerTier, 'schedule_enabled', updatedPixie.schedule_enabled),
      schedule_on_hour: updatedPixie.schedule_on_hour,
      schedule_on_minute: updatedPixie.schedule_on_minute,
      schedule_off_hour: updatedPixie.schedule_off_hour,
      schedule_off_minute: updatedPixie.schedule_off_minute,
      clock_enabled: updatedPixie.clock_enabled,
      timezone_offset: user?.timezone_offset ?? 0,
      has_owner: true
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error registrando frame con usuario:", error);
    res.status(500).json({ error: "Error al registrar el frame" });
  }
};

export const unlinkPixie = async (req: AuthenticatedRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (isNaN(id)) {
    res.status(400).json({ error: "ID de pixie inválido" });
    return;
  }

  try {
    const pixie = await prisma.pixie.findFirst({
      where: { id },
    });

    if (!pixie) {
      res.status(404).json({ error: "Frame no encontrado" });
      return;
    }

    if (pixie.created_by !== userId) {
      res.status(403).json({ error: "No tienes permisos para desvincular este frame" });
      return;
    }

    // Reset owner, name, and photo cursor
    await prisma.pixie.update({
      where: { id },
      data: {
        created_by: null,
        name: "frame.",
        photo_cursor: 0,
        pictures_on_queue: 0,
      },
    });

    // Delete all playlist items for this frame
    await prisma.playlist_items.deleteMany({
      where: { pixie_id: id },
    });

    // Send MQTT unlink action to the frame
    publishToMQTT(`frame/${id}`, JSON.stringify({ action: "unlink" }));

    console.log(`[Pixie] Frame ${id} desvinculado por usuario ${userId}`);
    res.status(200).json({ message: "Frame desvinculado correctamente" });
  } catch (error) {
    console.error("Error al desvincular frame:", error);
    res.status(500).json({ error: "Error al desvincular el frame" });
  }
};

export const getUserDrawablePixies = async (req: AuthenticatedRequest, res: Response) => {
  const username = req.params.username as string;
  const requesterId = req.user?.id;
  
  
  if (!requesterId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!username) {
    res.status(400).json({ error: "Username requerido" });
    return;
  }

  try {
    // Buscar el usuario por username
    const targetUser = await prisma.public_users.findFirst({
      where: { username: username }
    });

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    // TODO: Verificar que son amigos antes de permitir ver los pixies
    // Por ahora lo dejamos sin validación de amistad

    // Obtener pixies del usuario que permiten dibujo (solo premium)
    const pixies = await prisma.pixie.findMany({
      where: {
        created_by: targetUser.id,
        allow_draws: true,
        tier: 'premium'
      },
    });

    
    res.status(200).json({ pixies });
  } catch (error) {
    console.error("Error al obtener pixies para dibujo:", error);
    res.status(500).json({ error: "Error al obtener los pixies del usuario" });
  }
};

