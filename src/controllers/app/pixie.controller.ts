import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from '../../services/prisma';
import { publishToMQTT } from '../../mqtt/client';


export const getPixiesByUser = async (req: AuthenticatedRequest, res: Response) => {
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
  const { id, name, secs_between_photos, pictures_on_queue, brightness } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!id) {
    res.status(400).json({ error: "Se requiere el id del pixie" });
    return;
  }

  try {
    // Verificar que el pixie pertenece al usuario
    const existingPixie = await prisma.pixie.findFirst({
      where: {
        id: id,
        created_by: userId
      }
    });

    console.log("🔐 Pixie encontrada", existingPixie);

    if (!existingPixie) {
      res.status(404).json({ error: "Pixie no encontrado o no tienes permisos" });
      return;
    }

    // Actualizar el pixie
    const updatedPixie = await prisma.pixie.update({
      where: { id: id },
      data: {
        name,
        secs_between_photos,
        pictures_on_queue,
        brightness
      }
    });

    // Enviar mensaje MQTT
    publishToMQTT(`pixie/${existingPixie.id}`, {action: "update_info"});

    res.status(200).json({ pixie: updatedPixie });
  } catch (error) {
    console.error("Error al actualizar pixie:", error);
    res.status(500).json({ error: "Error al actualizar el pixie" });
  }
};
