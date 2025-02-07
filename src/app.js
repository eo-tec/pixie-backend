"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
const config_1 = require("./config");
const bot_1 = require("./telegram/bot");
const client_1 = require("./mqtt/client");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Rutas principales
app.use('/', routes_1.mainRouter);
// Iniciar el servidor
app.listen(config_1.PORT, () => {
    console.log(`Servidor escuchando en puerto ${config_1.PORT}`);
});
// Iniciar Telegram Bot
(0, bot_1.initTelegramBot)();
(0, client_1.connectMQTT)();
