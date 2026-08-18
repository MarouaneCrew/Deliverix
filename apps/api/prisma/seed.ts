import 'dotenv/config';
import * as bcrypt from "bcryptjs";
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    const password = '123';

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: {
            email: 'admin@deliverix.local',
        },
        update: {
            passwordHash,
            role: "ADMIN",
            isActive: true,
            deletedAt: null
        },
        create: {
            email: 'admin@deliverix.local',
            passwordHash,
            role: "ADMIN",
        }
    });

    console.log("Developement user ready:", user.email);

}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });