import mqtt from 'mqtt';

// Configuración MQTT
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'pixie/photos';

let client: mqtt.MqttClient;

export const connectMQTT = () => {
  client = mqtt.connect(MQTT_BROKER_URL, {
    username: process.env.MQTT_BROKER_USERNAME,
    password: process.env.MQTT_BROKER_PASSWORD,
  });

  client.on('connect', () => {
    console.log(`📡 Conectado a MQTT en ${MQTT_BROKER_URL}`);
  });

  client.on('error', (err) => {
    console.error('❌ Error en MQTT:', err);
  });
};

export const publishToMQTT = (topic: string, message: string | object) => {
  if (!client || !client.connected) {
    console.error('⚠️ No se puede publicar en MQTT: Cliente no conectado');
    return;
  }

  const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);

  client.publish(topic, messageToSend, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Error publicando en MQTT:', err);
    } else {
      console.log(`📤 Mensaje enviado a ${topic}:`, messageToSend);
    }
  });
};
