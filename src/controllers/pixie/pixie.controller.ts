// src/controllers/versions.controller.ts
import { Request, Response } from "express";
import prisma from "../../services/prisma";
import crypto from "crypto";

const generateRandomCode = (id: number) => {
  const secret = process.env.SECRET_KEY;
  const length = 4;
  const DIGEST_BYTES = 5;
  if (!secret) throw new Error("Secret key missing");

  // 1) Generamos HMAC-BLAKE2s( id , secret )
  const hmac = crypto.createHmac("blake2s256", Buffer.from(secret, "utf8"));
  hmac.update(String(id));
  const digest = hmac.digest().subarray(0, DIGEST_BYTES); // 40 bits

  // 2) Convertimos a Base64 “segura” y nos quedamos con letras/números
  const b64 = digest.toString("base64"); // incluye + / =
  const safe = b64.replace(/[^0-9A-Za-z]/g, ""); // solo A-Z a-z 0-9

  // 3) Ajustamos la longitud requerida
  return safe.slice(0, length).padEnd(length, "0"); // rellena por si acaso
};

export const addPixie = async (req: Request, res: Response) => {
  const { mac } = req.body;
  console.log("Se añade un Pixie con MAC: ", mac);

  if (!mac) {
    res.status(400).json({ error: "MAC address is required" });
    return;
  }

  try {
    const randomCode = generateRandomCode(mac.toString());
    const pixie = await prisma.pixie.create({
      data: {
        mac: mac,
        name: "Pixie",
        code: randomCode,
      },
    });

    if (!pixie) {
      throw Error("Error creating Pixie");
    }
    console.log("Pixie añadido: ", pixie);

    res.status(200).json({
      message: "Pixie added successfully",
      pixie,
      code: randomCode,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPixie = async (req: Request, res: Response) => {
  const pixieId = parseInt(String(req.query.id), 10);
  console.log("Se obtiene un Pixie con ID: ", pixieId);
  if (isNaN(pixieId) || pixieId < 0) {
    res.status(400).json({ error: "Invalid pixieId parameter" });
    return;
  }

  console.log("Se obtiene un Pixie con ID: ", pixieId);

  try {
    const pixie = await prisma.pixie.findUnique({
      where: { id: pixieId },
    });

    if (!pixie) {
      res.status(404).json({ error: "Pixie not found for the given pixieId" });
      return;
    }

    res.status(200).json({ pixie });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
