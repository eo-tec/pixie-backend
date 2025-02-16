import { Request, Response } from 'express';
import { PrismaClient } from "@prisma/client";
import { supabase } from '../../config';
import { AuthenticatedRequest } from '../../routes/private/checkUser';
import { Readable } from 'stream';

const prisma = new PrismaClient();

export async function getPhotosFromUser(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;

    if (!id) {
        res.status(401).send('Error: usuario no autenticado.');
        return;
    }

    try {
        const photos = await prisma.photos.findMany({
            distinct: ['photo_url'],
            include: {
                users: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });


        if (!photos) {
            console.error('Error al obtener las fotos');
            res.status(500).send('Error al obtener las fotos.');
            return;
        }

        res.status(200).json(photos);
    } catch (err) {
        console.error('/photo error:', err);
        res.status(500).send('Error al obtener la foto.');
    }
}

export async function postPhoto(req: Request, res: Response) {
    try {
        const { userId, title, photoFile } = req.body;

        if (!userId || !photoFile) {
            console.log("❌ Error: datos incompletos.");
            res.status(400).send("Error: datos incompletos.");
            return 
        }

        // 📌 Verificar si el usuario existe
        const user = await prisma.public_users.findFirst({
            where: { user_id: userId },
            select: { id: true, username: true },
        });

        if (!user) {
            res.status(404).send("❌ Error: usuario no encontrado.");
            return 
        }

        // 📌 Convertir la imagen de Base64 a Buffer
        const fileBuffer = Buffer.from(photoFile, "base64");

        // 📌 Subir la imagen a Supabase Storage
        const fileName = `${user.username}/${Date.now()}_${title}.png`;
        const { data, error } = await supabase.storage
            .from("photos")
            .upload(fileName, fileBuffer, { contentType: "image/png" });

        if (error) {
            console.error("❌ Error al subir la foto:", error);
            res.status(500).send("Error al subir la foto.");
            return 
        }

        const { data: dataURL } = await supabase.storage.from("photos").getPublicUrl(data.path);
        
        const photoUrl = dataURL.publicUrl;

        // 📌 Guardar en la base de datos
        const newPhoto = await prisma.photos.create({
            data: {
                user_id: user.id,
                title: title,
                photo_url: photoUrl,
                created_at: new Date(),
            },
            include: {
                users: true,
            },
        });

        console.log("✅ Se ha creado la foto");
        res.status(201).json(newPhoto);
    } catch (err) {
        console.error("❌ /post-photo error:", err);
        res.status(500).send("Error al subir la foto.");
    }
}