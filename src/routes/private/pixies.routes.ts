import { Router } from "express";
import { getPixies, getUserDrawablePixies } from "../../controllers/app/pixie.controller";

export const pixiesRouter = Router();

// Obtener pixies del usuario logueado
pixiesRouter.get("/", getPixies);

// Obtener pixies con allow_draws=true de un usuario específico
pixiesRouter.get("/user/:username/drawable", getUserDrawablePixies);