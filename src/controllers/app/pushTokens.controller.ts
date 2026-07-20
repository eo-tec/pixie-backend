import { Response } from "express";
import { AuthenticatedRequest } from "../../routes/private/checkUser";
import prisma from "../../services/prisma";

const VALID_PLATFORMS = ["ios", "android"];

/** Formato de los tokens de Expo: ExponentPushToken[xxxxxxxx] */
const EXPO_TOKEN_PATTERN = /^ExponentPushToken\[.+\]$/;

/**
 * POST /api/push-token
 *
 * Registra el token del dispositivo. La app lo llama en cada arranque porque los
 * tokens de Expo rotan, asi que esto tiene que ser idempotente.
 *
 * El upsert va por `token`, no por usuario: un mismo telefono puede acabar en
 * manos de otra cuenta (logout + login), y en ese caso el token debe cambiar de
 * dueno en vez de duplicarse.
 */
export async function registerPushToken(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.user?.id;
  const { token, platform } = req.body ?? {};

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!token || typeof token !== "string" || !EXPO_TOKEN_PATTERN.test(token)) {
    res.status(400).json({ error: "Se requiere un token de Expo valido" });
    return;
  }

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: "Plataforma no valida" });
    return;
  }

  try {
    await prisma.push_tokens.upsert({
      where: { token },
      create: { token, platform, user_id: userId },
      update: { platform, user_id: userId, last_seen_at: new Date() },
    });

    res.status(200).json({ message: "Token registrado" });
  } catch (error) {
    console.error("Error registrando el push token:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * DELETE /api/push-token
 *
 * Borra el token al cerrar sesion, para que el siguiente usuario de ese telefono
 * no reciba notificaciones del anterior.
 *
 * Solo borra el token si pertenece a quien lo pide: un token es un identificador
 * de dispositivo que viaja en el body, y sin ese filtro cualquier usuario
 * autenticado podria desactivar las notificaciones de otro.
 */
export async function deletePushToken(
  req: AuthenticatedRequest,
  res: Response
) {
  const userId = req.user?.id;
  const { token } = req.body ?? {};

  if (!userId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return;
  }

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Se requiere el token" });
    return;
  }

  try {
    await prisma.push_tokens.deleteMany({
      where: { token, user_id: userId },
    });

    // Idempotente a proposito: que el token ya no estuviera no es un error para
    // quien esta cerrando sesion.
    res.status(200).json({ message: "Token eliminado" });
  } catch (error) {
    console.error("Error eliminando el push token:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
