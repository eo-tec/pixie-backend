import { randomBytes } from 'crypto';
import mqtt from 'mqtt';
import prisma from '../services/prisma';
import {
  handleSongRequest,
  handleCoverRequest,
  handlePhotoRequest,
  handleOtaRequest,
  handleConfigRequest,
  handleRegisterRequest,
  handleAnimationFrameRequest
} from './handlers';
import { createDeviceClient } from './dynSec';

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
const DYNSEC_RESPONSE_TOPIC = '$CONTROL/dynamic-security/v1/response';

let client: mqtt.MqttClient;

export const connectMQTT = () => {
  client = mqtt.connect(MQTT_BROKER_URL, {
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
    rejectUnauthorized: MQTT_BROKER_URL.startsWith('mqtts://'),
  });

  client.on('connect', () => {
    console.log(`Connected to MQTT at ${MQTT_BROKER_URL}`);

    // Suscribirse a requests de los ESP32 (frame/ + pixie/ backward compat)
    for (const topic of MQTT_REQUEST_TOPICS) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Error subscribing to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    }

    // Suscribirse a requests de registro por MAC (frame/ + pixie/ backward compat)
    for (const topic of MQTT_REGISTER_TOPICS) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Error subscribing to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    }

    // Subscribe to Dynamic Security plugin responses for logging
    client.subscribe(DYNSEC_RESPONSE_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.warn(`[DynSec] Could not subscribe to response topic (plugin may not be active):`, err.message);
      } else {
        console.log(`Subscribed to ${DYNSEC_RESPONSE_TOPIC}`);
      }
    });

    // Provision MQTT accounts for existing devices without mqtt_password
    provisionExistingDevices();
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });

  client.on('message', handleMqttMessage);
};

/**
 * Provision MQTT accounts for devices that were registered before auth was added.
 * Runs once on connect — generates mqtt_password and creates dynsec client for each.
 */
async function provisionExistingDevices(): Promise<void> {
  try {
    const unprovisionedDevices = await prisma.pixie.findMany({
      where: { mqtt_password: null },
    });

    if (unprovisionedDevices.length === 0) return;

    console.log(`[DynSec] Provisioning ${unprovisionedDevices.length} existing devices...`);

    for (const device of unprovisionedDevices) {
      try {
        const token = randomBytes(24).toString('base64url');
        await prisma.pixie.update({
          where: { id: device.id },
          data: { mqtt_password: token },
        });
        await createDeviceClient(device.mac, token, device.id);
        console.log(`[DynSec] Provisioned device: ${device.mac} (frame ${device.id})`);
      } catch (err) {
        console.warn(`[DynSec] Failed to provision device ${device.mac}:`, err);
      }
    }

    console.log(`[DynSec] Provisioning complete`);
  } catch (err) {
    console.error(`[DynSec] Error during provisioning:`, err);
  }
}

// Router de mensajes MQTT
async function handleMqttMessage(topic: string, payload: Buffer) {
  // Log Dynamic Security plugin responses
  if (topic === DYNSEC_RESPONSE_TOPIC) {
    try {
      const response = JSON.parse(payload.toString());
      const hasErrors = response.responses?.some((r: any) => r.error);
      if (hasErrors) {
        console.warn(`[DynSec] Response with errors:`, JSON.stringify(response));
      }
    } catch { /* ignore parse errors */ }
    return;
  }

  const parts = topic.split('/');

  // Manejar registro por MAC: frame/mac/{MAC}/request/register (o pixie/ backward compat)
  if (parts.length >= 5 && (parts[0] === 'frame' || parts[0] === 'pixie') && parts[1] === 'mac' && parts[3] === 'request' && parts[4] === 'register') {
    const mac = parts[2];
    console.log(`[MQTT] Register request for MAC: ${mac}`);
    await handleRegisterRequest(mac);
    return;
  }

  // Parsear topic: frame/{pixieId}/request/{type} (o pixie/ backward compat)
  if (parts.length < 4 || (parts[0] !== 'frame' && parts[0] !== 'pixie') || parts[2] !== 'request') {
    return; // No es un request válido
  }

  const pixieId = parseInt(parts[1], 10);
  const requestType = parts.slice(3).join('/'); // e.g. "photo" or "animation/frame"

  if (isNaN(pixieId)) {
    console.error(`[MQTT] Invalid pixieId in topic: ${topic}`);
    return;
  }

  updateFrameLastSeen(pixieId);
  console.log(`[MQTT] Request: ${requestType} for frame ${pixieId}`);

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

      case 'animation/frame': {
        let animPayload: { animationId: number; frame: number } = { animationId: 0, frame: 0 };
        try {
          animPayload = JSON.parse(payload.toString());
        } catch { /* invalid payload */ }
        await handleAnimationFrameRequest(pixieId, animPayload);
        break;
      }

      default:
        console.log(`[MQTT] Unknown request type: ${requestType}`);
    }
  } catch (err) {
    console.error(`[MQTT] Error processing ${requestType} for frame ${pixieId}:`, err);
  }
}

export const publishToMQTT = (topic: string, message: string | object) => {
  if (!client || !client.connected) {
    console.error('Cannot publish to MQTT: client not connected');
    return;
  }

  const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);

  client.publish(topic, messageToSend, { qos: 1 }, (err) => {
    if (err) {
      console.error('Error publishing to MQTT:', err);
    }
  });
};

// Publicar datos binarios (Buffer)
export const publishBinary = (topic: string, buffer: Buffer) => {
  if (!client || !client.connected) {
    console.error('Cannot publish to MQTT: client not connected');
    return;
  }

  client.publish(topic, buffer, { qos: 1 }, (err) => {
    if (err) {
      console.error('Error publishing binary to MQTT:', err);
    }
  });
};

export { client };
