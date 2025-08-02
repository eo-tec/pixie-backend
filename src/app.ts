// src/app.ts
import express from 'express';
import { mainRouter } from './routes';
import { PORT } from './config';
import { initTelegramBot } from './telegram/bot';
import bodyParser from 'body-parser';
import { connectMQTT } from './mqtt/client';
import { createServer } from 'https'
import { createServer as createHttpServer } from 'http'
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { checkBucket } from './minio/minio';
import { Server } from 'socket.io';
import { initDrawingSocket } from './websocket/drawing.socket';
import { requestLogger } from './middleware/requestLogger';

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

// Request logger middleware
app.use(requestLogger);

// Rutas principales
app.use('/', mainRouter);

let server;
let io;

// Check if we need HTTPS in development (only if certs exist)
const useHTTPS = process.env.NODE_ENV === 'development' && process.env.USE_HTTPS === 'true';

if (useHTTPS) {
  try {
    const options = {
      key: fs.readFileSync(path.resolve(__dirname, 'certs', 'server.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'certs', 'server.cert'))
    };

    server = createServer(options, app);
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    server.listen(PORT, () => {
      console.log(`Servidor seguro (HTTPS) escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error loading SSL certificates, falling back to HTTP:', error instanceof Error ? error.message : error);
    // Fallback to HTTP if certificates are not available
    server = createHttpServer(app);
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    server.listen(PORT, () => {
      console.log(`Servidor HTTP escuchando en puerto ${PORT} (fallback)`);
    });
  }
} else {
  // Use HTTP server (default for development and production)
  server = createHttpServer(app);
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  server.listen(PORT, () => {
    console.log(`Servidor HTTP escuchando en puerto ${PORT}`);
  });
  //initTelegramBot();
}

// Initialize WebSocket for drawing
initDrawingSocket(io);

connectMQTT();
