import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from '../../services/prisma';
import { publishToMQTT } from '../../mqtt/client';
import { pixie } from "@prisma/client";

export const getPixies = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.user?.id;
  console.log("🔐 getPixiesByUser", id);
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
  console.log("🔐 setPixie", req.body);
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

  try {
    // Verificar que el pixie pertenece al usuario
    const existingPixie = await prisma.pixie.findFirst({
      where: {
        id: pixie.id,        
      }
    });

    console.log("🔐 Pixie encontrada", existingPixie);

    if (!existingPixie) {
      res.status(404).json({ error: "Pixie no encontrado o no tienes permisos" });
      return;
    }

    // Actualizar el pixie
    const updatedPixie = await prisma.pixie.update({
      where: { id: pixie.id },
      data: {
        ...pixie
      }
    });

    // Enviar mensaje MQTT
    console.log("🔐 Enviando mensaje MQTT a topic", `pixie/${existingPixie.id}`);
    publishToMQTT(`pixie/${existingPixie.id}`, JSON.stringify({action: "update_info", pixie: updatedPixie}));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al actualizar pixie:", error);
    res.status(500).json({ error: "Error al actualizar el pixie" });
  }
};

export const showPhoto = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  console.log("🔐 showPhoto", id);

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

    // Enviar mensaje MQTT
    publishToMQTT(`pixie/${updatedPixie.id}`, JSON.stringify({action: "update_info", pixie: updatedPixie}));

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al activar pixie:", error);
    res.status(500).json({ error: "Error al activar el pixie" });
  }
};

