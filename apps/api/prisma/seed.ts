import 'dotenv/config';
import * as bcrypt from "bcryptjs";
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole } from '../src/generated/prisma/enums';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    const password = '123';
    const passwordHash = await bcrypt.hash(password, 10);

    // 1. Company
    await prisma.company.upsert({
        where: { id: 'seed-company' },
        create: { id: 'seed-company', name: 'Deliverix Demo' },
        update: { name: 'Deliverix Demo' },
    });

    // 2. Cities
    const cityNames = ['Casablanca', 'Rabat', 'Marrakech', 'Agadir', 'Tangier'];
    const cities = await Promise.all(
        cityNames.map((name) =>
            prisma.city.upsert({
                where: { name },
                create: { name },
                update: {},
            })
        )
    );

    // 3. Hubs (one per city)
    for (const city of cities) {
        await prisma.hub.upsert({
            where: {
                companyId_name: {
                    companyId: 'seed-company',
                    name: `${city.name} Hub`,
                },
            },
            create: {
                companyId: 'seed-company',
                cityId: city.id,
                name: `${city.name} Hub`,
            },
            update: {},
        });
    }

    // 4. Admin user
    await prisma.user.upsert({
        where: { email: 'admin@deliverix.local' },
        create: {
            email: 'admin@deliverix.local',
            passwordHash,
            fullName: 'Administrator',
            role: UserRole.ADMIN,
            isActive: true,
            deletedAt: null,
            companyId: 'seed-company',
            hubId: null,
        },
        update: {
            passwordHash,
            fullName: 'Administrator',
            role: UserRole.ADMIN,
            isActive: true,
            deletedAt: null,
            companyId: 'seed-company',
            hubId: null,
        },
    });

    console.log('Development seed ready');
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });