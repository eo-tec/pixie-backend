import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from '../../services/prisma';
import { publishToMQTT } from '../../mqtt/client';
import { pixie } from "@prisma/client";

// Endpoint para verificar si un frame está registrado (usado durante provisioning BLE)
export const checkFrameRegistration = async (req: Request, res: Response) => {
  const { frameToken } = req.params;

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
    });

    res.status(200).json({ pixies });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los pixies del usuario" });
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
    const { id, created_at, created_by, mac, ...updateData } = pixie;
    const updatedPixie = await prisma.pixie.update({
      where: { id: pixieId },
      data: updateData
    });

    // Enviar mensaje MQTT con campos en el root (formato esperado por ESP32)
    publishToMQTT(`pixie/${existingPixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: updatedPixie.pictures_on_queue,
      spotify_enabled: updatedPixie.spotify_enabled,
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al actualizar pixie:", error);
    res.status(500).json({ error: "Error al actualizar el pixie" });
  }
};

export const showPhoto = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const pixies = await prisma.pixie.findMany({
    where: {
      created_by: req.user?.id,
    },
  });

  pixies.map((pixie) => { 
    publishToMQTT(`pixie/${pixie.id}`, JSON.stringify({action: "update_photo", id}));
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

    // Enviar mensaje MQTT con campos en el root (formato esperado por ESP32)
    publishToMQTT(`pixie/${updatedPixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: updatedPixie.pictures_on_queue,
      spotify_enabled: updatedPixie.spotify_enabled,
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al activar pixie:", error);
    res.status(500).json({ error: "Error al activar el pixie" });
  }
};

export const resetPixie = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const pixieId = parseInt(id, 10);
  if (isNaN(pixieId)) {
    res.status(400).json({ error: "ID de pixie inválido" });
    return;
  }

  try {
    // Enviar mensaje MQTT para reset de fábrica
    publishToMQTT(`pixie/${pixieId}`, JSON.stringify({action: "factory_reset"}));
    
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
  const { frameToken } = req.params;  // MAC address como "78:1C:3C:A5:B4:5C"
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

    console.log(`[Pixie] Frame ${pixie.id} (MAC: ${frameToken}) registrado con usuario ${userId}`);

    // Enviar config al frame via MQTT
    publishToMQTT(`pixie/${pixie.id}`, JSON.stringify({
      action: "update_info",
      brightness: updatedPixie.brightness,
      pictures_on_queue: updatedPixie.pictures_on_queue,
      spotify_enabled: updatedPixie.spotify_enabled,
      secs_between_photos: updatedPixie.secs_between_photos,
      code: updatedPixie.code
    }));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error registrando frame con usuario:", error);
    res.status(500).json({ error: "Error al registrar el frame" });
  }
};

export const getUserDrawablePixies = async (req: AuthenticatedRequest, res: Response) => {
  const { username } = req.params;
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

    // Obtener pixies del usuario que permiten dibujo
    const pixies = await prisma.pixie.findMany({
      where: {
        created_by: targetUser.id,
        allow_draws: true
      },
    });

    
    res.status(200).json({ pixies });
  } catch (error) {
    console.error("Error al obtener pixies para dibujo:", error);
    res.status(500).json({ error: "Error al obtener los pixies del usuario" });
  }
};

