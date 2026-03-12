import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";

export async function createReport(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  const { photoId, reportedUserId, reason, description } = req.body;

  if (!reason) {
    res.status(400).json({ error: "Se requiere un motivo" });
    return;
  }

  const validReasons = ["inappropriate", "spam", "harassment", "other"];
  if (!validReasons.includes(reason)) {
    res.status(400).json({ error: "Motivo inválido" });
    return;
  }

  if (!photoId && !reportedUserId) {
    res.status(400).json({ error: "Se requiere photoId o reportedUserId" });
    return;
  }

  // Can't report yourself
  if (reportedUserId && reportedUserId === userId) {
    res.status(400).json({ error: "No puedes reportarte a ti mismo" });
    return;
  }

  try {
    // If reporting a photo, resolve the reported user from the photo
    let finalReportedUserId = reportedUserId ? parseInt(reportedUserId) : null;

    if (photoId) {
      const photo = await prisma.photos.findFirst({
        where: { id: parseInt(photoId), deleted_at: null },
        select: { user_id: true },
      });

      if (!photo) {
        res.status(404).json({ error: "Foto no encontrada" });
        return;
      }

      if (photo.user_id === userId) {
        res.status(400).json({ error: "No puedes reportar tu propia foto" });
        return;
      }

      finalReportedUserId = finalReportedUserId || photo.user_id;
    }

    const report = await prisma.content_reports.create({
      data: {
        reporter_id: userId,
        photo_id: photoId ? parseInt(photoId) : null,
        reported_user_id: finalReportedUserId,
        reason,
        description: description?.substring(0, 500) || null,
      },
    });

    // TODO: Send email notification to admin (alvaro.eotec@gmail.com)
    // For now, log it so it's visible in server logs
    console.log(`[REPORT] New report #${report.id}: reason=${reason}, reporter=${userId}, photo=${photoId || 'N/A'}, user=${finalReportedUserId || 'N/A'}`);

    res.status(201).json({ message: "Reporte enviado", id: report.id });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Error al crear el reporte" });
  }
}
