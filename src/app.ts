// src/app.ts
import express from 'express';
import { mainRouter } from './routes';
import { PORT } from './config';
import { initTelegramBot } from './telegram/bot';
import { connectMQTT } from './mqtt/client';

const app = express();

app.use(express.json());

// Rutas principales
app.use('/', mainRouter);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// Iniciar Telegram Bot
initTelegramBot();

connectMQTT();
