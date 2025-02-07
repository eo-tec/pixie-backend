"use strict";
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
exports.SpotifyService = void 0;
// src/services/spotify.service.ts
const spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
const fs_1 = __importDefault(require("fs"));
const REFRESH_TOKEN_FILE = './refresh_token.cache'; // O la ruta que prefieras
let ACCESS_TOKEN = null;
class SpotifyService {
    constructor(clientId, clientSecret, redirectUri) {
        this.spotifyApi = new spotify_web_api_node_1.default({ clientId, clientSecret, redirectUri });
        // Al instanciar, cargamos el refresh token si existe
        const refreshToken = this.loadRefreshToken();
        if (refreshToken) {
            this.spotifyApi.setRefreshToken(refreshToken);
        }
    }
    getApi() {
        return this.spotifyApi;
    }
    // Método para cargar refresh_token desde archivo
    loadRefreshToken() {
        if (fs_1.default.existsSync(REFRESH_TOKEN_FILE)) {
            const token = fs_1.default.readFileSync(REFRESH_TOKEN_FILE, 'utf-8').trim();
            console.log('Refresh Token cargado desde el archivo.');
            return token;
        }
        return null;
    }
    // Método para guardar refresh_token en archivo
    saveRefreshToken(token) {
        fs_1.default.writeFileSync(REFRESH_TOKEN_FILE, token, 'utf-8');
        console.log('Refresh Token guardado en el archivo.');
    }
    // Llamar cuando sea necesario refrescar el access token
    refreshAccessTokenIfNeeded() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.spotifyApi.refreshAccessToken();
                ACCESS_TOKEN = data.body.access_token;
                this.spotifyApi.setAccessToken(ACCESS_TOKEN);
            }
            catch (err) {
                console.error('Error al refrescar el Access Token:', err);
                throw new Error('No se pudo refrescar el Access Token.');
            }
        });
    }
    // Guardar refresh token en archivo cuando lo obtengamos
    saveNewRefreshToken(refreshToken) {
        this.saveRefreshToken(refreshToken);
    }
}
exports.SpotifyService = SpotifyService;
