import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './utils/db-cleanup';

describe('Rate limiting (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeEach(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();

        prisma = app.get(PrismaService);
        await cleanDatabase(prisma);
    });

    afterEach(async () => {
        await app.close();
    });

    it('blocks login after 5 rapid attempts in the window', async () => {
        const email = 'e2e-throttle@deliverix.test';

        for (let i = 0; i < 5; i++) {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'wrong' })
                .expect(401);
        }

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password: 'wrong' })
            .expect(429);
    });

    it('allows a single legitimate attempt through (no false positive)', async () => {
        const email = 'e2e-throttle-legit@deliverix.test';
        const password = 'password123';

        await prisma.user.create({
            data: { email, passwordHash: await hashForTest(password), role: 'ADMIN' },
        });

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email, password })
            .expect(201);
    });

    it(
        'blocks an unthrottled route after the global default (20/min)',
        async () => {
            for (let i = 0; i < 20; i++) {
                await request(app.getHttpServer()).get('/auth/me').expect(401);
            }

            await request(app.getHttpServer()).get('/auth/me').expect(429);
        },
        20000,
    );
});

async function hashForTest(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
}