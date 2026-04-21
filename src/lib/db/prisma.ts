import { PrismaClient } from '@prisma/client';

declare global {
    var __prisma: PrismaClient | undefined;
}

function resolveDatabaseUrl() {
    return process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || null;
}

export const databaseUrl = resolveDatabaseUrl();
export const isDatabaseConfigured = Boolean(databaseUrl);

export const prisma = isDatabaseConfigured
    ? global.__prisma ??
    new PrismaClient({
        datasources: {
            db: {
                url: databaseUrl!,
            },
        },
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
    : null;

if (process.env.NODE_ENV !== 'production' && prisma) {
    global.__prisma = prisma;
}
