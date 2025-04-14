// src/app.ts
import express from 'express';
import { mainRouter } from './routes';
import { PORT } from './config';
import { initTelegramBot } from './telegram/bot';
import bodyParser from 'body-parser';
import { connectMQTT } from './mqtt/client';
import { createServer } from 'https'
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { checkBucket } from './minio/minio';

const app = express();

// 🔥 Habilitar CORS para permitir solicitudes desde el frontend
app.use(cors({
  origin: '*', // Permite todas las solicitudes (puedes restringirlo)
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Headers permitidos
}));

app.use(express.json({ limit: "10mb" })); // Aumenta el límite si las imágenes son grandes
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); 
app.use(bodyParser.json({ limit: '10mb' }));

app.use(express.json());

app.use(express.static('public'));

// Rutas principales
app.use('/', mainRouter);

if (process.env.NODE_ENV === 'development') {
  const options = {
    key: fs.readFileSync(path.resolve(__dirname, 'certs', 'server.key')),
    cert: fs.readFileSync(path.resolve(__dirname, 'certs', 'server.cert'))
  };

  createServer(options, app).listen(PORT, () => {
    console.log(`Servidor seguro escuchando en puerto ${PORT}`);
  });
} else {
  // Iniciar el servidor
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
  });
  //initTelegramBot();
}

connectMQTT();
