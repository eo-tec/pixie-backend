"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToMQTT = exports.connectMQTT = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
// Configuración MQTT
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com';
const MQTT_TOPIC = 'pixie/photos';
let client;
const connectMQTT = () => {
    client = mqtt_1.default.connect(MQTT_BROKER_URL, {
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
exports.connectMQTT = connectMQTT;
const publishToMQTT = (topic, message) => {
    if (!client || !client.connected) {
        console.error('⚠️ No se puede publicar en MQTT: Cliente no conectado');
        return;
    }
    client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
            console.error('❌ Error publicando en MQTT:', err);
        }
        else {
            console.log(`📤 Mensaje enviado a ${MQTT_TOPIC}:`, message);
        }
    });
};
exports.publishToMQTT = publishToMQTT;
