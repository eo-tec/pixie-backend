// src/telegram/bot.ts
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { TELEGRAM_BOT_TOKEN, supabase, BUCKET_NAME } from '../config';
import { Database, Tables } from '../types/supabase'; // Importa los tipos generados de Supabase
import e from 'express';

type User = Tables<'users'>
type GroupSubscriber = Database['public']['Tables']["group_suscriber"]["Row"];
type Photo = Database['public']['Tables']['photos']['Row'];

export function initTelegramBot() {
  // Solo si hay token
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('No TELEGRAM_BOT_TOKEN found. Bot not started.');
    return;
  }

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  console.log('Bot de Telegram iniciado y escuchando mensajes...');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const username = msg.from?.first_name;
    console.log('Received message:', msg);

    // Ignorar mensajes que son comandos o respuestas a comandos
    if (msg.text?.startsWith('/') || msg.reply_to_message) {
      return;
    }

    if (!telegramId || !username) {
      return;
    }

    try {
      // Comprobar si el usuario ya existe
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, telegram_id')
        .eq('telegram_id', telegramId!.toString())
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error al comprobar el usuario:', userError.message);
        return;
      }

      // Si no existe, añadirlo
      let userId: number | undefined;
      if (!userData) {
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert(
            {
              telegram_id: telegramId.toString(),
              username: username
            })
          .select().single();

        if (insertError) {
          console.error('Error al insertar el usuario:', insertError.message);
          return;
        }

        userId = newUser?.id;
      } else {
        userId = userData.id;
      }

      // Comprobar si el usuario está suscrito a algún grupo
      const { data: groupData, error: groupError } = await supabase
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
    } catch (err) {
      console.error('Error procesando el mensaje:', err);
    }
  });

  bot.onText(/\/creargrupo/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '¿Cómo quieres que se llame el grupo?');

    bot.once('text', async (msg) => {
      const groupName = msg.text;
      const telegramId = msg.from?.id;

      if (!telegramId || !groupName) {
        return;
      }

      try {
        // Obtener el ID del usuario desde la base de datos
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', telegramId!.toString())
          .single();

        if (userError || !userData) {
          console.error('Error al obtener el ID del usuario:', userError?.message);
          bot.sendMessage(chatId, 'Error al obtener el ID del usuario.');
          return;
        }

        const userId = userData.id;

        // Crear grupo
        const { data: groupData, error: groupError } = await supabase
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
        const { error: subscriberError } = await supabase
          .from('group_suscriber')
          .insert([
            {
              group: groupData.id,
              user: userId,
            }],);

        if (subscriberError) {
          console.error('Error al añadir suscriptor al grupo:', subscriberError.message);
          bot.sendMessage(chatId, 'Error al añadir suscriptor al grupo: ' + subscriberError.message);
          return;
        }

        bot.sendMessage(chatId, `✔️ Grupo "${groupName}" creado correctamente y te has suscrito.`);
      } catch (err) {
        console.error('Error procesando la creación del grupo:', err);
        bot.sendMessage(chatId, 'Ocurrió un error al crear el grupo.');
      }
    });
  });

  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const photoArray = msg.photo;
    if (!photoArray || photoArray.length === 0) {
      bot.sendMessage(chatId, 'No photo found in your message.');
      return;
    }
    const photo = photoArray[photoArray.length - 1];
    const fileId = photo.file_id;

    try {
      // Obtener el ID del usuario desde la base de datos
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId!.toString())
        .single();

      if (userError || !userData) {
        console.error('Error al obtener el ID del usuario:', userError?.message);
        bot.sendMessage(chatId, 'Error al obtener el ID del usuario.');
        return;
      }

      const userId = userData.id;

      // Comprobar si el usuario está suscrito a algún grupo
      const { data: groupData, error: groupError } = await supabase
        .from('group_suscriber')
        .select('group(name, id)')
        .eq('user', userId);

      if (groupError) {
        console.error('Error al comprobar los grupos:', groupError.message);
        return;
      }

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

      bot.once('callback_query', async (callbackQuery) => {
        const groupId = callbackQuery.data;
        const selectedGroups = groupId === 'todos' ? groupData.map((group) => group.group.id) : [groupId];

        try {
          const file = await bot.getFile(fileId);
          const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;

          // Descargamos la imagen
          const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
          const fileData = response.data;

          // Nombre único
          const fileName = `${uuidv4()}.jpg`;

          // Subimos a Supabase
          const { error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(fileName, fileData, {
              contentType: 'image/jpeg',
            });

          if (error) {
            console.error('Error al subir la imagen:', error.message);
            bot.sendMessage(chatId, 'Error al subir la imagen a Supabase: ' + error.message);
            return;
          }

          // URL pública
          const { data: dataURL } = await supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
          if (!dataURL) {
            console.error('Error al obtener la URL pública');
            bot.sendMessage(chatId, 'Error al obtener la URL pública');
            return;
          }

          // Insertar en BD
          for (const group of selectedGroups) {
            const { error: insertError } = await supabase
              .from('photos')
              .insert([
                {
                  photo_url: dataURL.publicUrl,
                  username: msg.from?.first_name ?? '',
                  title: msg.caption ?? '',
                  group: Number(group),
                },
              ]);

            if (insertError) {
              console.error('Error al insertar en la base de datos:', insertError.message);
            }
          }

          bot.sendMessage(chatId, '✔️ Imagen subida correctamente');
        } catch (err) {
          console.error('Error procesando la foto:', err);
          bot.sendMessage(chatId, 'Ocurrió un error al procesar la foto.');
        }
      });
    } catch (err) {
      console.error('Error procesando la foto:', err);
      bot.sendMessage(chatId, 'Ocurrió un error al procesar la foto.');
    }
  });
}
