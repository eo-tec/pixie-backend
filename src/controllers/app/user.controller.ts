import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../routes/private/checkUser';
import prisma from '../../services/prisma';

async function getUser(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;
    console.log("🔐 getUser", id);
    if (!id) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }

    const user = await prisma.public_users.findFirst({
        where: {
            id: id
        },
        include: {
            spotify_credentials: true,
            pixie: true,
        }
    });

    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    res.status(200).json({
        user: {
            id: user.id,
            username: user.username,
            user_id: user.user_id,
            spotify_credentials: user.spotify_credentials,
            pixies: user.pixie
        }
    });
}

export { getUser };
