"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelegramBot = initTelegramBot;
// src/telegram/bot.ts
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const config_1 = require("../config");
function initTelegramBot() {
    // Solo si hay token
    if (!config_1.TELEGRAM_BOT_TOKEN) {
        console.log('No TELEGRAM_BOT_TOKEN found. Bot not started.');
        return;
    }
    const bot = new node_telegram_bot_api_1.default(config_1.TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('Bot de Telegram iniciado y escuchando mensajes...');
    bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const chatId = msg.chat.id;
        const telegramId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
        const username = (_b = msg.from) === null || _b === void 0 ? void 0 : _b.first_name;
        console.log('Received message:', msg);
        // Ignorar mensajes que son comandos o respuestas a comandos
        if (((_c = msg.text) === null || _c === void 0 ? void 0 : _c.startsWith('/')) || msg.reply_to_message) {
            return;
        }
        if (!telegramId || !username) {
            return;
        }
        try {
            // Comprobar si el usuario ya existe
            const { data: userData, error: userError } = yield config_1.supabase
                .from('users')
                .select('id, telegram_id')
                .eq('telegram_id', telegramId.toString())
                .single();
            if (userError && userError.code !== 'PGRST116') {
                console.error('Error al comprobar el usuario:', userError.message);
                return;
            }
            // Si no existe, añadirlo
            let userId;
            if (!userData) {
                const { data: newUser, error: insertError } = yield config_1.supabase
                    .from('users')
                    .insert({
                    telegram_id: telegramId.toString(),
                    username: username
                })
                    .select().single();
                if (insertError) {
                    console.error('Error al insertar el usuario:', insertError.message);
                    return;
                }
                userId = newUser === null || newUser === void 0 ? void 0 : newUser.id;
            }
            else {
                userId = userData.id;
            }
            // Comprobar si el usuario está suscrito a algún grupo
            const { data: groupData, error: groupError } = yield config_1.supabase
                .from('group_suscriber')
                .select("group")
                .eq('user', userId);
            if (groupError) {
                console.error('Error al comprobar los grupos:', groupError.message);
                return;
            }
            // Si no está suscrito a ningún grupo, enviar comando para crear grupo
            if (groupData.length === 0) {
                bot.sendMessage(chatId, 'No estás suscrito a ningún grupo. Usa /creargrupo para crear uno.');
            }
        }
        catch (err) {
            console.error('Error procesando el mensaje:', err);
        }
    }));
    bot.onText(/\/creargrupo/, (msg) => __awaiter(this, void 0, void 0, function* () {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '¿Cómo quieres que se llame el grupo?');
        bot.once('text', (msg) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const groupName = msg.text;
            const telegramId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
            if (!telegramId || !groupName) {
                return;
            }
            try {
                // Obtener el ID del usuario desde la base de datos
                const { data: userData, error: userError } = yield config_1.supabase
                    .from('users')
                    .select('id')
                    .eq('telegram_id', telegramId.toString())
                    .single();
                if (userError || !userData) {
                    console.error('Error al obtener el ID del usuario:', userError === null || userError === void 0 ? void 0 : userError.message);
                    bot.sendMessage(chatId, 'Error al obtener el ID del usuario.');
                    return;
                }
                const userId = userData.id;
                // Crear grupo
                const { data: groupData, error: groupError } = yield config_1.supabase
                    .from('groups')
                    .insert([
                    {
                        name: groupName,
                        created_by: userId,
                    },
                ])
                    .select().single();
                if (groupError) {
                    console.error('Error al crear el grupo:', groupError.message);
                    bot.sendMessage(chatId, 'Error al crear el grupo: ' + groupError.message);
                    return;
                }
                // Añadir suscriptor al grupo
                const { error: subscriberError } = yield config_1.supabase
                    .from('group_suscriber')
                    .insert([
                    {
                        group: groupData.id,
                        user: userId,
                    }
                ]);
                if (subscriberError) {
                    console.error('Error al añadir suscriptor al grupo:', subscriberError.message);
                    bot.sendMessage(chatId, 'Error al añadir suscriptor al grupo: ' + subscriberError.message);
                    return;
                }
                bot.sendMessage(chatId, `✔️ Grupo "${groupName}" creado correctamente y te has suscrito.`);
            }
            catch (err) {
                console.error('Error procesando la creación del grupo:', err);
                bot.sendMessage(chatId, 'Ocurrió un error al crear el grupo.');
            }
        }));
    }));
    bot.on('photo', (msg) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const chatId = msg.chat.id;
        const telegramId = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.id;
        const photoArray = msg.photo;
        if (!photoArray || photoArray.length === 0) {
            bot.sendMessage(chatId, 'No photo found in your message.');
            return;
        }
        const photo = photoArray[photoArray.length - 1];
        const fileId = photo.file_id;
        try {
            // Obtener el ID del usuario desde la base de datos
            const { data: userData, error: userError } = yield config_1.supabase
                .from('users')
                .select('id')
                .eq('telegram_id', telegramId.toString())
                .single();
            if (userError || !userData) {
                console.error('Error al obtener el ID del usuario:', userError === null || userError === void 0 ? void 0 : userError.message);
                bot.sendMessage(chatId, 'Error al obtener el ID del usuario.');
                return;
            }
            const userId = userData.id;
            // Comprobar si el usuario está suscrito a algún grupo
            const { data: groupData, error: groupError } = yield config_1.supabase
                .from('group_suscriber')
                .select('group(name, id)')
                .eq('user', userId);
            if (groupError) {
                console.error('Error al comprobar los grupos:', groupError.message);
                return;
            }
            console.log('groupData:', groupData);
            if (groupData.length === 0) {
                bot.sendMessage(chatId, 'No estás suscrito a ningún grupo.');
                return;
            }
            // Crear lista de opciones de grupos
            const groupOptions = groupData.map((row) => ({
                text: row.group.name,
                callback_data: row.group.id.toString(),
            }));
            if (groupData.length > 1) {
                groupOptions.push({
                    text: 'Todos',
                    callback_data: 'todos',
                });
            }
            bot.sendMessage(chatId, '¿A cuál grupo quieres enviar la foto?', {
                reply_markup: {
                    inline_keyboard: [groupOptions],
                },
            });
            bot.once('callback_query', (callbackQuery) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                const groupId = callbackQuery.data;
                const selectedGroups = groupId === 'todos' ? groupData.map((group) => group.group.id) : [groupId];
                try {
                    const file = yield bot.getFile(fileId);
                    const fileUrl = `https://api.telegram.org/file/bot${config_1.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
                    // Descargamos la imagen
                    const response = yield axios_1.default.get(fileUrl, { responseType: 'arraybuffer' });
                    const fileData = response.data;
                    // Nombre único
                    const fileName = `${(0, uuid_1.v4)()}.jpg`;
                    // Subimos a Supabase
                    const { error } = yield config_1.supabase
                        .storage
                        .from(config_1.BUCKET_NAME)
                        .upload(fileName, fileData, {
                        contentType: 'image/jpeg',
                    });
                    if (error) {
                        console.error('Error al subir la imagen:', error.message);
                        bot.sendMessage(chatId, 'Error al subir la imagen a Supabase: ' + error.message);
                        return;
                    }
                    // URL pública
                    const { data: dataURL } = yield config_1.supabase.storage.from(config_1.BUCKET_NAME).getPublicUrl(fileName);
                    if (!dataURL) {
                        console.error('Error al obtener la URL pública');
                        bot.sendMessage(chatId, 'Error al obtener la URL pública');
                        return;
                    }
                    // Insertar en BD
                    for (const group of selectedGroups) {
                        const { error: insertError } = yield config_1.supabase
                            .from('photos')
                            .insert([
                            {
                                photo_url: dataURL.publicUrl,
                                username: (_b = (_a = msg.from) === null || _a === void 0 ? void 0 : _a.first_name) !== null && _b !== void 0 ? _b : '',
                                title: (_c = msg.caption) !== null && _c !== void 0 ? _c : '',
                                group: Number(group),
                            },
                        ]);
                        if (insertError) {
                            console.error('Error al insertar en la base de datos:', insertError.message);
                        }
                    }
                    bot.sendMessage(chatId, '✔️ Imagen subida correctamente');
                }
                catch (err) {
                    console.error('Error procesando la foto:', err);
                    bot.sendMessage(chatId, 'Ocurrió un error al procesar la foto.');
                }
            }));
        }
        catch (err) {
            console.error('Error procesando la foto:', err);
            bot.sendMessage(chatId, 'Ocurrió un error al procesar la foto.');
        }
    }));
}
