"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spotifyRouter = void 0;
// src/routes/spotify.routes.ts
const express_1 = require("express");
const spotify_controller_1 = require("../controllers/spotify.controller");
// (importa idPlaying, me, etc. también)
exports.spotifyRouter = (0, express_1.Router)();
exports.spotifyRouter.get('/login', spotify_controller_1.login);
exports.spotifyRouter.get('/callback', spotify_controller_1.callback);
exports.spotifyRouter.get('/cover-64x64', spotify_controller_1.cover64x64);
exports.spotifyRouter.get('/id-playing', spotify_controller_1.idPlaying);
exports.spotifyRouter.get('/me', spotify_controller_1.me);
// ... etc.
