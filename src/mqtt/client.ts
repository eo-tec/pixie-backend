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

export const publishToMQTT = (topic: string, message: string) => {
  if (!client || !client.connected) {
    console.error('⚠️ No se puede publicar en MQTT: Cliente no conectado');
    return;
  }

  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Error publicando en MQTT:', err);
    } else {
      console.log(`📤 Mensaje enviado a ${MQTT_TOPIC}:`, message);
    }
  });
};
