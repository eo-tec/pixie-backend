// src/services/spotify.service.ts
import SpotifyWebApi from 'spotify-web-api-node';
import fs from 'fs';

const REFRESH_TOKEN_FILE = './refresh_token.cache'; // O la ruta que prefieras
let ACCESS_TOKEN: string | null = null;

export class SpotifyService {
  // La instancia de la API
  private spotifyApi: SpotifyWebApi;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.spotifyApi = new SpotifyWebApi({ clientId, clientSecret, redirectUri });
  }

  public getApi() {
    return this.spotifyApi;
  }

  // Método para cargar refresh_token desde archivo
  private loadRefreshToken(): string | null {
    if (fs.existsSync(REFRESH_TOKEN_FILE)) {
      const token = fs.readFileSync(REFRESH_TOKEN_FILE, 'utf-8').trim();
      return token;
    }
    return null;
  }

  // Método para guardar refresh_token en archivo
  private saveRefreshToken(token: string) {
    fs.writeFileSync(REFRESH_TOKEN_FILE, token, 'utf-8');
  }

  // Llamar cuando sea necesario refrescar el access token
  public async refreshAccessTokenIfNeeded() {
    try {
      const data = await this.spotifyApi.refreshAccessToken();
      ACCESS_TOKEN = data.body.access_token;
      this.spotifyApi.setAccessToken(ACCESS_TOKEN);
    } catch (err) {
      console.error('Error al refrescar el Access Token:', err);
      throw new Error('No se pudo refrescar el Access Token.');
    }
  }

  // Guardar refresh token en archivo cuando lo obtengamos
  public saveNewRefreshToken(refreshToken: string) {
    this.saveRefreshToken(refreshToken);
  }
}
