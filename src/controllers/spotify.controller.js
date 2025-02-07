"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.callback = callback;
exports.cover64x64 = cover64x64;
exports.idPlaying = idPlaying;
exports.me = me;
const sharp_1 = __importDefault(require("sharp"));
const fs = __importStar(require("fs"));
const spotify_service_1 = require("../services/spotify.service");
const config_1 = require("../config");
// Instancia global (o podrías inyectarla)
const spotifyService = new spotify_service_1.SpotifyService(config_1.SPOTIFY_CLIENT_ID, config_1.SPOTIFY_CLIENT_SECRET, config_1.SPOTIFY_REDIRECT_URI);
let ACCESS_TOKEN = null;
const REFRESH_TOKEN_FILE = '../../refresh_token.cache';
function login(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // Creas la URL de autorización
        const scopes = ['user-read-currently-playing', 'user-read-playback-state', 'user-read-private'];
        const state = 'someRandomState'; // replace with a valid state value as needed
        const authorizeURL = spotifyService.getApi().createAuthorizeURL(scopes, state);
        res.redirect(authorizeURL);
    });
}
function callback(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = req.query.code || null;
        if (!code) {
            res.send('Error: falta el parámetro "code".');
            return;
        }
        try {
            const data = yield spotifyService.getApi().authorizationCodeGrant(code);
            const accessToken = data.body.access_token;
            const refreshToken = data.body.refresh_token;
            spotifyService.getApi().setAccessToken(accessToken);
            spotifyService.getApi().setRefreshToken(refreshToken);
            // Guardar el refresh token
            spotifyService.saveNewRefreshToken(refreshToken);
            res.send('¡Autorización exitosa! Ahora puedes usar el servidor.');
        }
        catch (err) {
            console.error('Error en el intercambio de tokens:', err);
            res.status(500).send('Error al obtener el token.');
        }
    });
}
function cover64x64(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Refresca el token si es necesario
            yield spotifyService.refreshAccessTokenIfNeeded();
            const playbackState = yield spotifyService.getApi().getMyCurrentPlayingTrack();
            if (!playbackState.body || !playbackState.body.item) {
                res.status(404).send('No se está reproduciendo ninguna canción.');
                return;
            }
            let coverUrl;
            if ('album' in playbackState.body.item && playbackState.body.item.album.images.length > 0) {
                coverUrl = playbackState.body.item.album.images[0].url;
            }
            else if ('show' in playbackState.body.item && playbackState.body.item.show.images.length > 0) {
                coverUrl = playbackState.body.item.show.images[0].url;
            }
            else {
                res.status(404).send('No se encontró portada adecuada.');
                return;
            }
            const response = yield fetch(coverUrl);
            if (!response.ok) {
                throw new Error(`Error fetching image from URL: ${response.statusText}`);
            }
            const buffer = Buffer.from(yield response.arrayBuffer());
            yield (0, sharp_1.default)(buffer).metadata(); // (metadata no se usa, solo como ejemplo)
            const resizedBuffer = yield (0, sharp_1.default)(buffer)
                .resize(64, 64)
                .ensureAlpha()
                .raw()
                .toBuffer();
            const pixelData = [];
            for (let y = 0; y < 64; y++) {
                const row = [];
                for (let x = 0; x < 64; x++) {
                    const idx = (y * 64 + x) * 4;
                    const r = resizedBuffer[idx];
                    const g = resizedBuffer[idx + 1];
                    const b = resizedBuffer[idx + 2];
                    // Convertir a RGB565
                    const rgb565 = ((b & 0b11111000) << 8) | // 5 bits de rojo
                        ((r & 0b11111100) << 3) | // 6 bits de verde
                        (g >> 3); // 5 bits de azul
                    row.push(rgb565);
                }
                pixelData.push(row);
            }
            res.json({
                width: 64,
                height: 64,
                data: pixelData,
            });
        }
        catch (err) {
            console.error('/cover-64x64 error:', err);
            res.status(500).send('Error al procesar la portada.');
        }
    });
}
function idPlaying(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield refreshAccessTokenIfNeeded(); // Asegúrate de que el token está actualizado
            const playbackState = yield spotifyService.getApi().getMyCurrentPlaybackState();
            // Verificar si hay canción en reproducción
            if (!playbackState.body || playbackState.body.is_playing === false) {
                res.json({ id: "" }); // Devuelve un string vacío si no hay canción
                return;
            }
            let songId = ""; // ID de la canción
            if (playbackState.body.item) {
                songId = playbackState.body.item.id;
            }
            res.json({ id: songId }); // Devuelve el ID de la canción en JSON
        }
        catch (err) {
            console.error('/id-playing error:', err);
            res.status(500).json({ error: 'Error al obtener la canción actual.' });
        }
    });
}
function refreshAccessTokenIfNeeded() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield spotifyService.getApi().refreshAccessToken();
            ACCESS_TOKEN = data.body.access_token;
            spotifyService.getApi().setAccessToken(ACCESS_TOKEN);
        }
        catch (err) {
            console.error('Error al refrescar el Access Token:', err);
            throw new Error('No se pudo refrescar el Access Token.');
        }
    });
}
// -------------------------------------------------------------------
function loadRefreshToken() {
    if (fs.existsSync(REFRESH_TOKEN_FILE)) {
        const token = fs.readFileSync(REFRESH_TOKEN_FILE, 'utf-8').trim();
        console.log('Refresh Token cargado desde el archivo.');
        return token;
    }
    return null;
}
// -------------------------------------------------------------------
// 2. Guardar el Refresh Token en un archivo
// -------------------------------------------------------------------
function saveRefreshToken(token) {
    fs.writeFileSync(REFRESH_TOKEN_FILE, token, 'utf-8');
    console.log('Refresh Token guardado en el archivo.');
}
function me(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield refreshAccessTokenIfNeeded(); // Refresca el token si es necesario
            const meData = yield spotifyService.getApi().getMe();
            res.json({
                display_name: meData.body.display_name,
                email: meData.body.email,
                country: meData.body.country,
            });
        }
        catch (err) {
            console.error('/me error:', err);
            res.status(500).send('Error al obtener información del usuario.');
        }
    });
}
