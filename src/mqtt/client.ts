import mqtt from 'mqtt';
import {
  handleSongRequest,
  handleCoverRequest,
  handlePhotoRequest,
  handleOtaRequest,
  handleConfigRequest,
  handleRegisterRequest
} from './handlers';

// Frame online tracking (in-memory)
const frameLastSeen = new Map<number, Date>();
const ONLINE_THRESHOLD_MS = 60_000;

export function updateFrameLastSeen(pixieId: number): void {
  frameLastSeen.set(pixieId, new Date());
}

export function isFrameOnline(pixieId: number): boolean {
  const lastSeen = frameLastSeen.get(pixieId);
  if (!lastSeen) return false;
  return (Date.now() - lastSeen.getTime()) < ONLINE_THRESHOLD_MS;
}

export function getFrameLastSeen(pixieId: number): Date | null {
  return frameLastSeen.get(pixieId) ?? null;
}

// Configuración MQTT
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_REQUEST_TOPICS = [
  'frame/+/request/#',
  'pixie/+/request/#',           // backward compat firmwares viejos
];
const MQTT_REGISTER_TOPICS = [
  'frame/mac/+/request/register',
  'pixie/mac/+/request/register', // backward compat firmwares viejos
];

let client: mqtt.MqttClient;

export const connectMQTT = () => {
  client = mqtt.connect(MQTT_BROKER_URL, {
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
  });

  client.on('connect', () => {
    console.log(`📡 Conectado a MQTT en ${MQTT_BROKER_URL}`);

    // Suscribirse a requests de los ESP32 (frame/ + pixie/ backward compat)
    for (const topic of MQTT_REQUEST_TOPICS) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Error suscribiéndose a ${topic}:`, err);
        } else {
          console.log(`📥 Suscrito a ${topic}`);
        }
      });
    }

    // Suscribirse a requests de registro por MAC (frame/ + pixie/ backward compat)
    for (const topic of MQTT_REGISTER_TOPICS) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`❌ Error suscribiéndose a ${topic}:`, err);
        } else {
          console.log(`📥 Suscrito a ${topic}`);
        }
      });
    }
  });

  client.on('error', (err) => {
    console.error('❌ Error en MQTT:', err);
  });

  client.on('message', handleMqttMessage);
};

// Router de mensajes MQTT
async function handleMqttMessage(topic: string, payload: Buffer) {
  const parts = topic.split('/');

  // Manejar registro por MAC: frame/mac/{MAC}/request/register (o pixie/ backward compat)
  if (parts.length >= 5 && (parts[0] === 'frame' || parts[0] === 'pixie') && parts[1] === 'mac' && parts[3] === 'request' && parts[4] === 'register') {
    const mac = parts[2];
    console.log(`📨 [MQTT] Register request para MAC: ${mac}`);
    await handleRegisterRequest(mac);
    return;
  }

  // Parsear topic: frame/{pixieId}/request/{type} (o pixie/ backward compat)
  if (parts.length < 4 || (parts[0] !== 'frame' && parts[0] !== 'pixie') || parts[2] !== 'request') {
    return; // No es un request válido
  }

  const pixieId = parseInt(parts[1], 10);
  const requestType = parts[3];

  if (isNaN(pixieId)) {
    console.error(`[MQTT] pixieId inválido en topic: ${topic}`);
    return;
  }

  updateFrameLastSeen(pixieId);
  console.log(`📨 [MQTT] Request recibido: ${requestType} para frame ${pixieId}`);

  try {
    switch (requestType) {
      case 'song':
        await handleSongRequest(pixieId);
        break;

      case 'cover': {
        let songId = '';
        try {
          const data = JSON.parse(payload.toString());
          songId = data.songId || '';
        } catch { /* payload vacío o inválido */ }
        await handleCoverRequest(pixieId, songId);
        break;
      }

      case 'photo': {
        let photoPayload: { index?: number; id?: number } = {};
        try {
          photoPayload = JSON.parse(payload.toString());
        } catch { /* payload vacío o inválido */ }
        await handlePhotoRequest(pixieId, photoPayload);
        break;
      }

      case 'ota':
        await handleOtaRequest(pixieId);
        break;

      case 'config':
        await handleConfigRequest(pixieId);
        break;

      default:
        console.log(`[MQTT] Tipo de request desconocido: ${requestType}`);
    }
  } catch (err) {
    console.error(`[MQTT] Error procesando ${requestType} para frame ${pixieId}:`, err);
  }
}

export const publishToMQTT = (topic: string, message: string | object) => {
  if (!client || !client.connected) {
    console.error('⚠️ No se puede publicar en MQTT: Cliente no conectado');
    return;
  }

  const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);

  client.publish(topic, messageToSend, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Error publicando en MQTT:', err);
    }
  });
};

// Publicar datos binarios (Buffer)
export const publishBinary = (topic: string, buffer: Buffer) => {
  if (!client || !client.connected) {
    console.error('⚠️ No se puede publicar en MQTT: Cliente no conectado');
    return;
  }

  client.publish(topic, buffer, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Error publicando binario en MQTT:', err);
    }
  });
};

export { client };
