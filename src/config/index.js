"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.TELEGRAM_BOT_TOKEN = exports.SPOTIFY_REDIRECT_URI = exports.SPOTIFY_CLIENT_SECRET = exports.SPOTIFY_CLIENT_ID = exports.BUCKET_NAME = exports.SUPABASE_KEY = exports.SUPABASE_URL = exports.PORT = void 0;
// src/config/index.ts
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
exports.PORT = process.env.PORT || '3000';
exports.SUPABASE_URL = process.env.SUPABASE_URL || '';
exports.SUPABASE_KEY = process.env.SUPABASE_KEY || '';
exports.BUCKET_NAME = process.env.BUCKET_NAME || '';
exports.SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
exports.SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
exports.SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || '';
exports.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
// Crear el cliente de Supabase tipado (si tienes `src/types/supabase.ts`)
exports.supabase = (0, supabase_js_1.createClient)(exports.SUPABASE_URL, exports.SUPABASE_KEY);
