"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainRouter = void 0;
// src/routes/index.ts
const express_1 = require("express");
const spotify_routes_1 = require("./spotify.routes");
const photos_routes_1 = require("./photos.routes");
// Otras rutas que tengas
exports.mainRouter = (0, express_1.Router)();
exports.mainRouter.use('/spotify', spotify_routes_1.spotifyRouter);
exports.mainRouter.use('/photo', photos_routes_1.photosRouter);
