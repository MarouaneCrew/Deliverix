import { PrismaClient } from '../../src/generated/prisma/client';

export async function cleanDatabase(prisma: PrismaClient) {
    await prisma.user.deleteMany();
}