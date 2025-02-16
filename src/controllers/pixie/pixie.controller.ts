// src/controllers/versions.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../../config';

export const addPixie = async (req: Request, res: Response) => {
    const { mac } = req.body;

    if (!mac) {
        res.status(400).json({ error: 'MAC address is required' });
        return 
    }

    try {
        const { data, error } = await supabase
            .from('pixie')
            .insert([{ mac: mac, name: 'Pixie' }])
            .select('id')
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Pixie added successfully', data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};



