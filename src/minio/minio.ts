import { Client } from "minio";
import * as mime from "mime-types";

const publicUrl = process.env.MINIO_PUBLIC_URL || "bucket.mypixelframe.com";

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "bucket.mypixelframe.com",
  port: parseInt(process.env.MINIO_PORT || "80"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: "euw",
});

// Function to check bucket "photos"
export const checkBucket = async () => {
  const bucketExists = await minioClient.bucketExists(
    process.env.MINIO_BUCKET || "photos"
  );
  if (!bucketExists) {
    await minioClient.makeBucket(process.env.MINIO_BUCKET || "photos");
  }
};

// Function to upload a file (Buffer) to the bucket
// returns the url of the file
export const uploadFile = async (file: Buffer, fileName: string, contentType: string) => {
  try {
    const response = await minioClient.putObject(
      process.env.MINIO_BUCKET || "photos",
      fileName,
      file,
      file.length,
      {
        'Content-Type': contentType,
      }
    );
    return `${publicUrl}/${process.env.MINIO_BUCKET}/${fileName}`;
  } catch (error: any) {
    console.error("❌ Error al subir el archivo:", error);
    // --- AÑADE ESTO PARA VER LA RESPUESTA REAL ---
    if (error && error.$response) {
      console.error("--- Raw Response Received ---");
      // Inspecciona la respuesta completa o partes específicas
      console.error("Status Code:", error.$response.statusCode);
      console.error("Headers:", error.$response.headers);
      // El cuerpo puede estar en 'body', necesitar parseo o ser un stream
      // Intenta obtenerlo como texto si es posible (la implementación exacta puede variar)
      // Esto es un intento, puede que necesites adaptarlo:
      try {
        const responseBody = await error.$response.body?.transformToString(); // O método similar si existe
        console.error("Body:", responseBody);
      } catch (bodyError) {
        console.error("Could not retrieve response body:", bodyError);
        console.error("Response body (raw):", error.$response.body);
      }
      console.error("-----------------------------");
    }
    throw error;
  }
};

// Function to download a file from the bucket
export const downloadFile = async (fileName: string) => {
  const fileStream = await minioClient.getObject(
    process.env.MINIO_BUCKET || "photos",
    fileName
  );
  return fileStream;
};

export const checkFile = async (fileName: string) => {
  try{
    const fileExists = await minioClient.statObject(
      process.env.MINIO_BUCKET || "photos",
      fileName
    );
    // devuelve verdadero si existe
    return fileExists;
  } catch (error) {
    return false;
  }
};

// Function to get presigned url
export const getPresignedUrl = async (fileName: string) => {
  const url = await minioClient.presignedUrl(
    "GET",
    process.env.MINIO_BUCKET || "photos",
    fileName,
    3600
  );
  return url;
};

export const getPresignedUrlBin = async (fileName: string) => {
  const url = await minioClient.presignedUrl(
    "GET",
    "versions",
    fileName,
    3600
  );
  return url;
};

export default minioClient;

/*
import {
  S3Client,
  HeadBucketCommand, // Para verificar si existe el bucket
  CreateBucketCommand, // Para crear el bucket
  PutObjectCommand, // Para subir objetos
  GetObjectCommand, // Para descargar objetos
  NotFound, // Error específico para bucket no encontrado
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // Para URLs prefirmadas
import { Readable } from "stream"; // Para tipado del stream de descarga

// --- Configuración del Cliente S3 ---

// Construye el endpoint completo incluyendo protocolo y puerto si no es estándar
const useSSL = false;
const protocol = useSSL ? "https://" : "http://";
const port = process.env.MINIO_PORT; // Puerto 443/80 para acceso externo vía dominio, 9000 para acceso interno vía service name
const host = process.env.MINIO_ENDPOINT || "bucket.mypixelframe.com"; // Dominio público o nombre de servicio interno
const endpoint = `${protocol}${host}${port ? ":" + port : ""}`; // Añade puerto solo si está definido

const s3Client = new S3Client({
  endpoint: endpoint, // URL completa del endpoint MinIO/S3
  region: process.env.AWS_REGION || "euw", // Región (importante para la SDK, 'us-east-1' es común para MinIO)
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "", // Asegúrate que no estén vacías
    secretAccessKey: process.env.MINIO_SECRET_KEY || "", // Asegúrate que no estén vacías
  },
  forcePathStyle: true, // ¡MUY IMPORTANTE para MinIO! Usa estilo de ruta (endpoint/bucket/key)
});

const BUCKET_NAME = process.env.MINIO_BUCKET || "photos";

// --- Funciones Refactorizadas ---

// S3 Client config removed for cleaner logs

// Función para verificar/crear el bucket "photos"
export const checkBucket = async () => {
  try {
    // HeadBucket es una forma ligera de verificar existencia y permisos
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (error: any) {
    // Si el error es 'NotFound', el bucket no existe y podemos crearlo
    if (
      error.name === "NotFound" ||
      error.name === "NoSuchBucket" ||
      error.$metadata?.httpStatusCode === 404
    ) {
      // Diferentes SDKs/versiones pueden dar nombres distintos
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      } catch (createError) {
        console.error(`Failed to create bucket "${BUCKET_NAME}":`, createError);
        throw createError; // Relanza el error si falla la creación
      }
    } else {
      // Otro error (permisos, conexión, etc.)
      console.error(`Error checking bucket "${BUCKET_NAME}":`, error);
      throw error; // Relanza el error
    }
  }
};

// Función para subir un archivo (Buffer) al bucket
// Devuelve la URL pública (¡solo si el bucket es público!) o la clave del objeto
export const uploadFile = async (
  file: Buffer,
  fileName: string
): Promise<string> => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName, // El nombre/ruta del archivo en el bucket
    Body: file, // El contenido del archivo (Buffer, Stream, string, etc.)
    // ContentType: 'image/png', // Opcional: puedes añadir el tipo de contenido
    // ACL: 'public-read' // Opcional: ¡NO USAR si el bucket ya es público por política! Esto es obsoleto en muchos casos.
  };

  try {
    await s3Client.send(new PutObjectCommand(params));

    // Construir la URL pública (¡CUIDADO! Solo si el bucket es público)
    // Asegúrate que MINIO_ENDPOINT tenga el protocolo y que el bucket permita lectura pública
    // Y codifica el nombre del archivo por si tiene caracteres especiales
    // const publicUrl = `${endpoint}/${BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    // return publicUrl;

    // Alternativa más segura: devolver solo el nombre del archivo (Key)
    // El frontend luego puede solicitar una URL prefirmada si es necesario
    return fileName;
  } catch (error: any) {
    console.error(`Failed to upload file "${fileName}":`, error);
    if (error && error.$response) {
      console.error("--- Raw Response Received ---");
      // Inspecciona la respuesta completa o partes específicas
      console.error("Status Code:", error.$response.statusCode);
      console.error("Headers:", error.$response.headers);
      // El cuerpo puede estar en 'body', necesitar parseo o ser un stream
      // Intenta obtenerlo como texto si es posible (la implementación exacta puede variar)
      // Esto es un intento, puede que necesites adaptarlo:
      try {
        const responseBody = await error.$response.body?.transformToString(); // O método similar si existe
        console.error("Body:", responseBody);
      } catch (bodyError) {
        console.error("Could not retrieve response body:", bodyError);
        console.error("Response body (raw):", error.$response.body);
      }
      console.error("-----------------------------");
    }
    throw error;
  }
};

// Función para descargar un archivo del bucket como un Stream
export const downloadFile = async (
  fileName: string
): Promise<Readable | undefined> => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
  };

  try {
    const response = await s3Client.send(new GetObjectCommand(params));
    // El cuerpo de la respuesta es un ReadableStream
    return response.Body as Readable | undefined;
  } catch (error) {
    console.error(`Failed to download file "${fileName}":`, error);
    throw error;
  }
};

// Función para obtener una URL prefirmada para descargar (GET)
export const getPresignedUrl = async (
  fileName: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
  };
  const command = new GetObjectCommand(params);

  try {
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });
    return url;
  } catch (error) {
    console.error(`Failed to generate presigned URL for "${fileName}":`, error);
    throw error;
  }
};

export default s3Client; // Puedes exportar el cliente si lo usas en otros sitios
*/
