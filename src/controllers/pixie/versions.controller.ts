// src/controllers/versions.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../../config';


export async function getLatestVersion(req: Request, res: Response) {
  try {
    const { data: versions, error } = await supabase
      .from('code_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error al obtener la última versión:', error.message);
      res.status(500).send('Error al obtener la última versión.');
      return;
    }

    if (!versions || versions.length === 0) {
      res.status(404).send('Versión no encontrada.');
      return;
    }

    res.json(versions[0]);
  } catch (err) {
    console.error('/get-latest-version error:', err);
    res.status(500).send('Error al procesar la solicitud.');
  }
}
