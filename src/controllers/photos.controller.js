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
exports.getPhotoUrl = getPhotoUrl;
exports.getPhoto = getPhoto;
const sharp_1 = __importDefault(require("sharp"));
const config_1 = require("../config");
function getPhotoUrl(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // const userDto = plainToInstance(GetPhotoDto, req.query);
        // if(await validate(userDto).then(errors => errors.length > 0)) {
        //   res.status(400).send('Error: parámetro "id" inválido.');
        //   return
        // }
        const idParam = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
        if (!idParam) {
            res.status(400).send('Error: parámetro "id" inválido.');
            return;
        }
        const id = parseInt(String(idParam), 10);
        if (isNaN(id) || id < 0) {
            res.status(400).send('Error: parámetro "id" inválido.');
            return;
        }
        try {
            // Consulta a Supabase para obtener las últimas 5 fotos subidas
            const { data: photos, error } = yield config_1.supabase
                .from('photos')
                .select('photo_url, title, username')
                .order('created_at', { ascending: false })
                .limit(5);
            if (error) {
                console.error('Error al obtener las fotos:', error.message);
                res.status(500).send('Error al obtener las fotos.');
                return;
            }
            if (!photos || id >= photos.length) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const photo = photos[id];
            if (!photo.photo_url) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const response = yield fetch(photo.photo_url);
            const buffer = Buffer.from(yield response.arrayBuffer());
            // Recortar la imagen para que sea 1:1 y centrada
            const metadata = yield (0, sharp_1.default)(buffer).metadata();
            if (metadata.width === undefined || metadata.height === undefined) {
                throw new Error("Error: No se pudieron obtener las dimensiones de la imagen.");
            }
            const size = Math.min(metadata.width, metadata.height);
            const left = Math.floor((metadata.width - size) / 2);
            const top = Math.floor((metadata.height - size) / 2);
            const resizedBuffer = yield (0, sharp_1.default)(buffer)
                .extract({ left, top, width: size, height: size })
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
                    // Convertir a RGB565 (5 bits rojo, 6 bits verde, 5 bits azul)
                    const rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
                    row.push(rgb565);
                }
                pixelData.push(row);
            }
            // Quitar solo los acentos de photo.username y photo.title
            if (!photo.username || !photo.title) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const cleanUsername = photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const clearTitle = photo.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            res.json({
                photo: {
                    width: 64,
                    height: 64,
                    data: pixelData,
                },
                title: clearTitle,
                username: cleanUsername,
            });
        }
        catch (err) {
            console.error('/get-photo error:', err);
            res.status(500).send('Error al procesar la solicitud.');
        }
    });
}
function getPhoto(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Pidieron foto");
        console.log(req.query);
        const id = parseInt(String(req.query.id), 10);
        if (isNaN(id) || id < 0) {
            res.status(400).send('Error: parámetro "id" inválido.');
            return;
        }
        try {
            const { data: photos, error } = yield config_1.supabase
                .from('photos')
                .select('photo_url, title, username')
                .order('created_at', { ascending: false })
                .limit(5);
            if (error) {
                console.error('Error al obtener las fotos:', error.message);
                res.status(500).send('Error al obtener las fotos.');
                return;
            }
            if (!photos || id >= photos.length) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const photo = photos[id];
            if (!photo.photo_url) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const response = yield fetch(photo.photo_url);
            const buffer = Buffer.from(yield response.arrayBuffer());
            const metadata = yield (0, sharp_1.default)(buffer).metadata();
            if (metadata.width === undefined || metadata.height === undefined) {
                throw new Error("Error: No se pudieron obtener las dimensiones de la imagen.");
            }
            const size = Math.min(metadata.width, metadata.height);
            const left = Math.floor((metadata.width - size) / 2);
            const top = Math.floor((metadata.height - size) / 2);
            const resizedBuffer = yield (0, sharp_1.default)(buffer)
                .extract({ left, top, width: size, height: size })
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
                    // Convertir a RGB565: 5 bits rojo, 6 bits verde y 5 bits azul
                    const rgb565 = ((b & 0b11111000) << 8) | ((r & 0b11111100) << 3) | (g >> 3);
                    row.push(rgb565);
                }
                pixelData.push(row);
            }
            if (!photo.username || !photo.title) {
                res.status(404).send('Foto no encontrada.');
                return;
            }
            const cleanUsername = photo.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const clearTitle = photo.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            res.json({
                photo: {
                    width: 64,
                    height: 64,
                    data: pixelData,
                },
                title: clearTitle,
                username: cleanUsername,
            });
        }
        catch (err) {
            console.error('/get-photo error:', err);
            res.status(500).send('Error al procesar la solicitud.');
        }
    });
}
