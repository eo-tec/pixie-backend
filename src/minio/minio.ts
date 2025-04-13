import { Client} from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio.mypixelframe.com',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

// Function to check bucket "photos"
export const checkBucket = async () => {
  const bucketExists = await minioClient.bucketExists(process.env.MINIO_BUCKET || 'photos');
  if (!bucketExists) {
    await minioClient.makeBucket(process.env.MINIO_BUCKET || 'photos');
  }
};

// Function to upload a file (Buffer) to the bucket
// returns the url of the file
export const uploadFile = async (file: Buffer, fileName: string) => {
  await minioClient.putObject(process.env.MINIO_BUCKET || 'photos', fileName, file);
  return `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${fileName}`;
};

// Function to download a file from the bucket
export const downloadFile = async (fileName: string) => {
  const fileStream = await minioClient.getObject(process.env.MINIO_BUCKET || 'photos', fileName);
  return fileStream;
};

// Function to get presigned url
export const getPresignedUrl = async (fileName: string) => {
  const url = await minioClient.presignedUrl('GET', process.env.MINIO_BUCKET || 'photos', fileName);
  return url;
};







export default minioClient;


