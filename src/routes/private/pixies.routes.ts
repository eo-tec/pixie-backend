import { Router } from "express";
import { getPixies, getPixie, getUserDrawablePixies, checkFrameRegistration, registerFrameWithUser, unlinkPixie } from "../../controllers/app/pixie.controller";

export const pixiesRouter = Router();

// Verificar si un frame está registrado (para provisioning BLE)
// Nota: Esta ruta no requiere autenticación ya que se usa durante el setup
pixiesRouter.get("/check-registration/:frameToken", checkFrameRegistration);

// Obtener pixies del usuario logueado
pixiesRouter.get("/", getPixies);

// Obtener pixies con allow_draws=true de un usuario específico
pixiesRouter.get("/user/:username/drawable", getUserDrawablePixies);

// Registrar un frame con el usuario actual (asociar pixie al usuario por MAC)
pixiesRouter.post("/:frameToken/register", registerFrameWithUser);

// Desvincular un frame (quitar owner)
pixiesRouter.delete("/:id/unlink", unlinkPixie);

// Obtener un pixie específico por ID (debe ir después de las rutas con prefijo estático)
pixiesRouter.get("/:id", getPixie);
