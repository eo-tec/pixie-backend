import { Request, Response } from "express";
import prisma from "../../services/prisma";
import { cleanUsername } from "../../utils/string-utils";

export const checkUsername = async (req: Request, res: Response) => {
  const { username } = req.params;
  if (!username || username.length < 3) {
    res.status(400).json({ available: false, error: "Username must be at least 3 characters" });
    return;
  }

  try {
    const cleaned = cleanUsername(username as string);
    const existing = await prisma.public_users.findFirst({
      where: { username: cleaned },
    });
    res.json({ available: !existing, username: cleaned });
  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({ available: false, error: "Internal server error" });
  }
};

export const newUser = async (req: Request, res: Response) => {
    const { username, user_id } = req.body;
    if (!username || !user_id) {
      res.status(400).json({ error: "Username or email not provided" });
      return;
    }
  
    try {
      // Limpiar y validar el username
      const cleanedUsername = cleanUsername(username);
      
      // Comprobar si el usuario ya existe
      const user = await prisma.public_users.findFirst({
        where: { user_id }
      });
    
      if (user) {
        res.status(400).json({ error: "User already exists" });
        return;
      }
    
      const userName = await prisma.public_users.findFirst({
        where: { username: cleanedUsername }
      });
    
      if (userName) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
      
      // Crear un nuevo usuario
      const newUser = await prisma.public_users.create({
        data: { username: cleanedUsername, user_id }
      });
    
      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };