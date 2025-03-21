// src/controllers/versions.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../../config';
import prisma from '../../services/prisma';

export const addPixie = async (req: Request, res: Response) => {
    const { mac } = req.body;
    console.log("Se añade un Pixie con MAC: ", mac);

    if (!mac) {
        res.status(400).json({ error: 'MAC address is required' });
        return 
    }

    try {
        const pixie = await prisma.pixie.create({
            data: {
                mac: mac,
                name: 'Pixie'
            }
        });
        
        if (!pixie) {
            throw Error('Error creating Pixie');
        }
        console.log("Pixie añadido: ", pixie);

        res.status(200).json({ message: 'Pixie added successfully', pixie });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getPixie = async (req: Request, res: Response) => {
    const pixieId = parseInt(String(req.query.id), 10);
    console.log("Se obtiene un Pixie con ID: ", pixieId);
    if (isNaN(pixieId) || pixieId < 0) {
        res.status(400).json({ error: 'Invalid pixieId parameter' });
        return;
    }

    console.log("Se obtiene un Pixie con ID: ", pixieId);

    try {
        const pixie = await prisma.pixie.findUnique({
            where: { id: pixieId }
        });

        if (!pixie) {
            res.status(404).json({ error: 'Pixie not found for the given pixieId' });
            return;
        }

        res.status(200).json({ pixie });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
