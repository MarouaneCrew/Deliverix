import { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Empties every table in the TEST database. Refuses to run against any
 * database whose name does not end with "_test".
 * Future-proof: it discovers tables from the catalog, so new models need no edits here.
 */
export async function cleanDatabase(prisma: PrismaClient) {
    const rows = await prisma.$queryRaw<{ current_database: string; }[]>`SELECT current_database()`;
    const dbName = rows[0].current_database;

    if (!dbName.endsWith('_test')) {
        throw new Error(`Refusing to clean database "${dbName}": its name must end with "_test"`);
    }

    const tables = await prisma.$queryRaw<{ tablename: string; }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

    if (tables.length === 0) return;

    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}