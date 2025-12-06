import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../routes/private/checkUser';
import prisma from '../../services/prisma';
import { uploadFile } from '../../minio/minio';
import sharp from 'sharp';

async function getUser(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;
    if (!id) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }

    const user = await prisma.public_users.findFirst({
        where: {
            id: id
        },
        include: {
            spotify_credentials: true
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
            picture: user.picture,
            bio: user.bio,
            spotify_id: user.spotify_credentials ? user.spotify_credentials.spotify_id : null,
        }
    });
}

async function getFriends(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;
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

interface UpdateProfileRequest {
    username?: string;
    bio?: string;
    picture?: string; // base64 encoded image
}

function cleanUsername(username: string): string {
    return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

async function updateProfile(req: AuthenticatedRequest, res: Response) {
    const id = req.user?.id;
    if (!id) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }

    const { username, bio, picture }: UpdateProfileRequest = req.body;

    try {
        // Validate username if provided
        if (username !== undefined) {
            const cleanedUsername = cleanUsername(username);

            if (cleanedUsername.length < 3) {
                res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
                return;
            }

            if (cleanedUsername.length > 30) {
                res.status(400).json({ error: 'El nombre de usuario no puede tener más de 30 caracteres' });
                return;
            }

            // Check if username is taken by another user
            const existingUser = await prisma.public_users.findFirst({
                where: {
                    username: cleanedUsername,
                    id: { not: id }
                }
            });

            if (existingUser) {
                res.status(400).json({ error: 'Este nombre de usuario ya está en uso' });
                return;
            }
        }

        // Validate bio length if provided
        if (bio !== undefined && bio.length > 150) {
            res.status(400).json({ error: 'La bio no puede tener más de 150 caracteres' });
            return;
        }

        let pictureUrl: string | undefined;

        // Handle picture upload if provided
        if (picture) {
            try {
                const base64Data = picture.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                // Process image with sharp - resize and convert to jpeg
                const processedBuffer = await sharp(buffer)
                    .resize(300, 300, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                const fileName = `profile-pictures/${id}-${Date.now()}.jpg`;
                pictureUrl = await uploadFile(processedBuffer, fileName, 'image/jpeg');
            } catch (imageError) {
                console.error('Error processing profile picture:', imageError);
                res.status(400).json({ error: 'Error al procesar la imagen' });
                return;
            }
        }

        // Build update data object - only include fields that were provided
        const updateData: { username?: string; bio?: string; picture?: string } = {};
        if (username !== undefined) updateData.username = cleanUsername(username);
        if (bio !== undefined) updateData.bio = bio;
        if (pictureUrl) updateData.picture = pictureUrl;

        // Only update if there's something to update
        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'No hay datos para actualizar' });
            return;
        }

        const updatedUser = await prisma.public_users.update({
            where: { id },
            data: updateData,
            include: {
                spotify_credentials: true
            }
        });

        res.status(200).json({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                picture: updatedUser.picture,
                bio: updatedUser.bio,
                spotify_id: updatedUser.spotify_credentials?.spotify_id ?? null,
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
}

export { getUser, getFriends, updateProfile };
