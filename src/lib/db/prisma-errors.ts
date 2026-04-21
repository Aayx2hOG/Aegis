import { Prisma } from '@prisma/client';

const MISSING_TABLE_CODES = new Set(['P2021', 'P2022']);

export function getDatabaseSetupErrorMessage(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && MISSING_TABLE_CODES.has(err.code)) {
        return 'Database schema is not up to date. Run Prisma migration (npm run prisma:migrate:deploy).';
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
        return 'Database connection failed. Check DATABASE_URL or POSTGRES_PRISMA_URL.';
    }

    return null;
}
