import { Request, Response } from "express";
import prisma from "../../services/prisma";

export const newUser = async (req: Request, res: Response) => {
    const { username, user_id } = req.body;
    console.log("🔐 newUser", username, user_id);
    if (!username || !user_id) {
      res.status(400).json({ error: "Username or email not provided" });
      return;
    }
  
    // Comprobar si el usuario ya existe
    const user = await prisma.public_users.findFirst({
      where: { user_id }
    });
  
    if (user) {
      res.status(400).json({ error: "User already exists" });
      return;
    }
  
    const userName = await prisma.public_users.findFirst({
      where: { username }
    });
  
    if (userName) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
    // Crear un nuevo usuario
    const newUser = await prisma.public_users.create({
      data: { username, user_id }
    });
  
    res.json(newUser);
  };