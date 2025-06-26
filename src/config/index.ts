// src/config/index.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

export const PORT = process.env.PORT || '3000';
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
export const BUCKET_NAME = process.env.BUCKET_NAME || '';

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
export const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || '';
export const GUESS_SPOTIFY_REDIRECT_URI = process.env.GUESS_SPOTIFY_REDIRECT_URI || '';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// Crear el cliente de Supabase tipado (si tienes `src/types/supabase.ts`)
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
