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
    });

    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    res.status(200).json({
        user: {
            id: user.user_id,
            username: user.username,
            picture: user.picture,
        }
    });
}

async function getFriends(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;
    console.log("🔐 getFriends", id);
    if (!id) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }

    const user = await prisma.public_users.findFirst({
        where: {
            id: id
        },
        include: {
            friends_sent: {
                where: {
                    status: 'accepted'
                },
                include: {
                    user2: {
                        select: {
                            id: true,
                            username: true,
                            picture: true
                        }
                    }
                }
            },
            friends_received: {
                where: {
                    status: 'accepted'
                },
                include: {
                    user1: {
                        select: {
                            id: true,
                            username: true,
                            picture: true
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    // Combinar amigos enviados y recibidos
    const friends = [
        ...user.friends_sent.map(friend => ({
            id: friend.user2.id,
            username: friend.user2.username,
            picture: friend.user2.picture
        })),
        ...user.friends_received.map(friend => ({
            id: friend.user1.id,
            username: friend.user1.username,
            picture: friend.user1.picture
        }))
    ].filter(friend => friend.username !== user.username);

    res.status(200).json({ friends });
}

export { getUser, getFriends };
