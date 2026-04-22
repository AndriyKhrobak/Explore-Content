import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (!globalForPrisma.__prisma) {
  globalForPrisma.__prisma = prisma;
}
