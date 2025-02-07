"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photosRouter = void 0;
// src/routes/photos.routes.ts
const express_1 = require("express");
const photos_controller_1 = require("../controllers/photos.controller");
exports.photosRouter = (0, express_1.Router)();
exports.photosRouter.get('/get-photo-url', photos_controller_1.getPhotoUrl);
exports.photosRouter.get('/get-photo', photos_controller_1.getPhoto);
