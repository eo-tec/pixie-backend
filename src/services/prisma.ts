import { PrismaClient } from '@prisma/client';

// 🔥 Configurar Prisma para convertir BigInt a Number automáticamente
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export default prisma;
