import { PrismaClient } from '@prisma/client';

declare global {
    var __prisma: PrismaClient | undefined;
}

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const prisma = isDatabaseConfigured
    ? global.__prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
    : null;

if (process.env.NODE_ENV !== 'production' && prisma) {
    global.__prisma = prisma;
}
