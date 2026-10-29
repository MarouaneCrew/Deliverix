import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './utils/db-cleanup';
import { createTenant, createUserFixture, loginAs } from './utils/fixtures';

let tenant: Awaited<ReturnType<typeof createTenant>>;

describe('Users (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleRef: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();

        prisma = app.get(PrismaService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await cleanDatabase(prisma);
        tenant = await createTenant(prisma);
    });

    async function createAndLogin(role: 'ADMIN' | 'DISPATCHER' | 'DRIVER') {
        const { email } = await createUserFixture(prisma, {
            companyId: tenant.company.id,
            role,
        });

        const loginRes = await loginAs(app, email, 'password123');
        return { email, accessToken: loginRes.accessToken as string };
    }

    describe('POST /users', () => {
        it('ADMIN creates a DISPATCHER user, response excludes passwordHash, includes hubId', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            const res = await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'new-dispatcher@deliverix.test', password: 'password123', role: 'DISPATCHER', hubId: tenant.hub.id })
                .expect(201);

            expect(res.body).toMatchObject({ email: 'new-dispatcher@deliverix.test', role: 'DISPATCHER', hubId: tenant.hub.id });
            expect(res.body).not.toHaveProperty('passwordHash');
        });

        it('rejects creating a DRIVER via /users (drivers are created via /drivers)', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'new-driver@deliverix.test', password: 'password123', role: 'DRIVER' })
                .expect(400);
        });

        it('rejects when caller is not ADMIN (403)', async () => {
            const { accessToken } = await createAndLogin('DISPATCHER');

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'blocked@deliverix.test', password: 'password123', role: 'DRIVER', hubId: tenant.hub.id })
                .expect(403);
        });

        it('rejects unauthenticated requests (401)', async () => {
            await request(app.getHttpServer())
                .post('/users')
                .send({ email: 'anon@deliverix.test', password: 'password123', role: 'DRIVER' })
                .expect(401);
        });

        it('rejects a duplicate email with 409', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'dup@deliverix.test', password: 'password123', role: 'DISPATCHER', hubId: tenant.hub.id })
                .expect(201);

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'dup@deliverix.test', password: 'password123', role: 'DISPATCHER', hubId: tenant.hub.id })
                .expect(409);
        });

        it('rejects a password shorter than 8 characters', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'shortpw@deliverix.test', password: 'short', role: 'DISPATCHER', hubId: tenant.hub.id })
                .expect(400);
        });
    });

    describe('GET /users', () => {
        it('ADMIN lists users', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            await createAndLogin('DISPATCHER');

            const res = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(2);
        });

        it('rejects non-ADMIN with 403', async () => {
            const { accessToken } = await createAndLogin('DRIVER');

            await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(403);
        });

        it('rejects unauthenticated with 401', async () => {
            await request(app.getHttpServer()).get('/users').expect(401);
        });
    });

    describe('GET /users/:id', () => {
        it('ADMIN views a specific user', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const target = await createAndLogin('DISPATCHER');

            const user = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

            const res = await request(app.getHttpServer())
                .get(`/users/${user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.email).toBe(target.email);
        });

        it('returns 404 for an unknown id', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .get('/users/does-not-exist')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(404);
        });

        it('rejects non-ADMIN with 403', async () => {
            const { accessToken } = await createAndLogin('DISPATCHER');

            await request(app.getHttpServer())
                .get('/users/anything')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(403);
        });
    });

    describe('PATCH /users/:id', () => {
        it('ADMIN updates a user email', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const target = await createAndLogin('DISPATCHER');
            const user = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

            const res = await request(app.getHttpServer())
                .patch(`/users/${user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'updated@deliverix.test' })
                .expect(200);

            expect(res.body.email).toBe('updated@deliverix.test');
        });

        it('ADMIN deactivates a user via isActive', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const target = await createAndLogin('DRIVER');
            const user = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

            const res = await request(app.getHttpServer())
                .patch(`/users/${user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ isActive: false })
                .expect(200);

            expect(res.body.isActive).toBe(false);
        });

        it('ignores a role field on update (role is immutable)', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const target = await createAndLogin('DISPATCHER');
            const user = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

            await request(app.getHttpServer())
                .patch(`/users/${user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ role: 'ADMIN' })
                .expect(200);

            const updated = await prisma.user.findUnique({ where: { id: user.id } });
            expect(updated.role).toBe('DISPATCHER');
        });

        it('returns 404 updating an unknown id', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .patch('/users/does-not-exist')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'whatever@deliverix.test' })
                .expect(404);
        });

        it('rejects non-ADMIN with 403', async () => {
            const { accessToken } = await createAndLogin('DRIVER');

            await request(app.getHttpServer())
                .patch('/users/anything')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'nope@deliverix.test' })
                .expect(403);
        });
    });

    describe('DELETE /users/:id', () => {
        it('soft-deletes: isActive false, deletedAt set, and login stops working', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const target = await createAndLogin('DRIVER');
            const user = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

            await request(app.getHttpServer())
                .delete(`/users/${user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
            expect(dbUser.isActive).toBe(false);
            expect(dbUser.deletedAt).not.toBeNull();

            // The row still exists (soft delete), but auth must now reject it
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: target.email, password: 'password123' })
                .expect(401);
        });

        it('returns 404 deleting an unknown id', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .delete('/users/does-not-exist')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(404);
        });

        it('rejects non-ADMIN with 403', async () => {
            const { accessToken } = await createAndLogin('DISPATCHER');

            await request(app.getHttpServer())
                .delete('/users/anything')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(403);
        });
    });

    // NEW T1.2F tests
    describe('Tenancy', () => {
        let secondTenant: Awaited<ReturnType<typeof createTenant>>;

        beforeEach(async () => {
            secondTenant = await createTenant(prisma, ' B');
        });

        it('POST /users with hubId of another company returns 404', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            await request(app.getHttpServer())
                .post('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ email: 'cross-company@deliverix.test', password: 'password123', role: 'DISPATCHER', hubId: secondTenant.hub.id })
                .expect(404);
        });

        it('PATCH /users/:id with hubId on non-DISPATCHER role returns 400', async () => {
            const { accessToken } = await createAndLogin('ADMIN');
            const driver = await createUserFixture(prisma, {
                companyId: tenant.company.id,
                role: 'DRIVER',
            });

            await request(app.getHttpServer())
                .patch(`/users/${driver.user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ hubId: tenant.hub.id })
                .expect(400);
        });

        it('GET /users/:id for a user of another company returns 404', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            const otherUser = await createUserFixture(prisma, {
                companyId: secondTenant.company.id,
                role: 'DRIVER',
            });

            await request(app.getHttpServer())
                .get(`/users/${otherUser.user.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(404);
        });

        it('GET /users returns only users of the caller\'s company', async () => {
            const { accessToken } = await createAndLogin('ADMIN');

            // Create a user in the second company
            await createUserFixture(prisma, {
                companyId: secondTenant.company.id,
                role: 'DRIVER',
            });

            const res = await request(app.getHttpServer())
                .get('/users')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            // Should only see users from the first company
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            // Check that no user from the second company is included
            const otherUserEmail = await prisma.user.findFirst({
                where: { companyId: secondTenant.company.id },
                select: { email: true },
            });
            if (otherUserEmail) {
                expect(res.body).not.toContainEqual(expect.objectContaining({ email: otherUserEmail.email }));
            }
        });
    });
});

async function hashForTest(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
}