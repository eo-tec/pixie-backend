import mqtt from 'mqtt';
import {
  handleSongRequest,
  handleCoverRequest,
  handlePhotoRequest,
  handleOtaRequest,
  handleConfigRequest
} from './handlers';

// Configuración MQTT
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'pixie/photos';
const MQTT_REQUEST_TOPIC = 'pixie/+/request/#';

let client: mqtt.MqttClient;

export const connectMQTT = () => {
  client = mqtt.connect(MQTT_BROKER_URL, {
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
  });

  client.on('connect', () => {
    console.log(`📡 Conectado a MQTT en ${MQTT_BROKER_URL}`);

    // Suscribirse a requests de los ESP32
    client.subscribe(MQTT_REQUEST_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ Error suscribiéndose a requests:', err);
      } else {
        console.log(`📥 Suscrito a ${MQTT_REQUEST_TOPIC}`);
      }
    });
  });

  client.on('error', (err) => {
    console.error('❌ Error en MQTT:', err);
  });

  client.on('message', handleMqttMessage);
};

// Router de mensajes MQTT
async function handleMqttMessage(topic: string, payload: Buffer) {
  // Parsear topic: pixie/{pixieId}/request/{type}
  const parts = topic.split('/');
  if (parts.length < 4 || parts[0] !== 'pixie' || parts[2] !== 'request') {
    return; // No es un request válido
  }

  const pixieId = parseInt(parts[1], 10);
  const requestType = parts[3];

  if (isNaN(pixieId)) {
    console.error(`[MQTT] pixieId inválido en topic: ${topic}`);
    return;
  }

  console.log(`📨 [MQTT] Request recibido: ${requestType} para pixie ${pixieId}`);

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
    console.error(`[MQTT] Error procesando ${requestType} para pixie ${pixieId}:`, err);
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
