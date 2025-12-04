import { Router } from "express";
import { getPixies, getUserDrawablePixies, checkFrameRegistration, registerFrameWithUser } from "../../controllers/app/pixie.controller";

export const pixiesRouter = Router();

// Verificar si un frame está registrado (para provisioning BLE)
// Nota: Esta ruta no requiere autenticación ya que se usa durante el setup
pixiesRouter.get("/check-registration/:frameToken", checkFrameRegistration);

// Obtener pixies del usuario logueado
pixiesRouter.get("/", getPixies);

// Registrar un frame con el usuario actual (asociar pixie al usuario por MAC)
pixiesRouter.post("/:frameToken/register", registerFrameWithUser);

// Obtener pixies con allow_draws=true de un usuario específico
pixiesRouter.get("/user/:username/drawable", getUserDrawablePixies);