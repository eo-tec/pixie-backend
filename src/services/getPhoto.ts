import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const CACHE_FOLDER = path.join(os.tmpdir(), "image_cache");
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

// Asegurar que la carpeta de caché existe
if (!fs.existsSync(CACHE_FOLDER)) {
  fs.mkdirSync(CACHE_FOLDER);
}

// Función para descargar y cachear imágenes
async function getPhoto(imageUrl: string): Promise<string> {
  const hash = crypto.createHash("md5").update(imageUrl).digest("hex");
  const filePath = path.join(CACHE_FOLDER, `${hash}.jpg`);

  // Si el archivo ya existe en caché, devolver el path
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  // Descargar la imagen y guardarla en caché
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  fs.writeFileSync(filePath, response.data);
  return filePath;
}

// Limpiar archivos viejos cada hora
function cleanOldFiles() {
  const now = Date.now();
  fs.readdir(CACHE_FOLDER, (err, files) => {
    if (err) return console.error("Error leyendo la carpeta:", err);
    files.forEach((file) => {
      const filePath = path.join(CACHE_FOLDER, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.atimeMs > EXPIRATION_TIME) {
          fs.unlink(filePath, () => console.log(`Archivo eliminado: ${filePath}`));
        }
      });
    });
  });
}
setInterval(cleanOldFiles, 60 * 60 * 1000); // Ejecutar cada hora
