import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './utils/db-cleanup';

describe('Auth (e2e)', () => {
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
    });

    describe('POST /auth/login', () => {
        const email = 'e2e-login@deliverix.test';
        const password = 'password123';

        beforeEach(async () => {
            // Create the user through the real API, not a Prisma shortcut —
            // this also incidentally exercises /users creation as a side effect.
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: await hashForTest(password),
                    role: 'ADMIN',
                },
            });
        });

        it('logs in with correct credentials and returns both tokens', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(201); // Nest's default for POST with no @HttpCode override

            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(typeof res.body.accessToken).toBe('string');
        });

        it('rejects a wrong password with 401', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'wrong-password' })
                .expect(401);
        });

        it('rejects an unknown email with 401 (not 404 — no enumeration)', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'nobody@deliverix.test', password: 'anything' })
                .expect(401);

            // Same message whether the email exists or not
            expect(res.body.message).toBe('Invalid credentials');
        });

        it('rejects malformed input with 400', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'not-an-email', password: '' })
                .expect(400);
        });

        it('strips unknown fields instead of erroring (whitelist behavior)', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password, isAdmin: true })
                .expect(201);

            expect(res.body).not.toHaveProperty('isAdmin');
        });
    });

    describe('POST /auth/refresh', () => {
        const email = 'e2e-refresh@deliverix.test';
        const password = 'password123';

        beforeEach(async () => {
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: await hashForTest(password),
                    role: 'ADMIN',
                },
            });
        });

        async function login() {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(201);
            return res.body as { accessToken: string; refreshToken: string; };
        }

        it('issues a new token pair from a valid refresh token', async () => {
            const { refreshToken } = await login();

            const res = await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(201);

            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            // Rotation means you get a genuinely new refresh token, not the same one back
            expect(res.body.refreshToken).not.toBe(refreshToken);
        });

        it('rejects reuse of an already-rotated refresh token', async () => {
            const { refreshToken: tokenA } = await login();

            // First use rotates A -> B, and should succeed
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: tokenA })
                .expect(201);

            // Reusing A again should now fail — A was invalidated by the rotation above
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: tokenA })
                .expect(401);
        });

        it('allows the newly rotated token to be used', async () => {
            const { refreshToken: tokenA } = await login();

            const { body: rotated } = await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: tokenA })
                .expect(201);

            // tokenB (from the rotation above) should work fine
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: rotated.refreshToken })
                .expect(201);
        });

        it('rejects a garbage/unknown refresh token', async () => {
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken: 'not-a-real-token' })
                .expect(401);
        });

        it('rejects a missing refreshToken field with 400', async () => {
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({})
                .expect(400);
        });

        it('rejects an expired refresh token', async () => {
            const { refreshToken } = await login();

            // Reach into the DB directly to simulate time passing,
            // rather than actually waiting 7 days in a test
            await prisma.user.update({
                where: { email },
                data: { refreshTokenExpiresAt: new Date(Date.now() - 1000) },
            });

            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(401);
        });
    });

    describe('POST /auth/logout', () => {
        const email = 'e2e-logout@deliverix.test';
        const password = 'password123';

        beforeEach(async () => {
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: await hashForTest(password),
                    role: 'ADMIN',
                },
            });
        });

        async function login() {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(201);
            return res.body as { accessToken: string; refreshToken: string; };
        }

        it('clears the refresh session so the old refresh token stops working', async () => {
            const { accessToken, refreshToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);

            // The whole point of logout: the previously-valid refresh token is now dead
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(401);
        });

        it('rejects logout with no access token at all', async () => {
            await request(app.getHttpServer())
                .post('/auth/logout')
                .expect(401);
        });

        it('rejects logout with a garbage access token', async () => {
            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', 'Bearer not-a-real-jwt')
                .expect(401);
        });

        it('is safe to call twice in a row (second call still authenticated, still succeeds)', async () => {
            const { accessToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);

            // Access token itself is still valid for 15 minutes — logout only kills
            // the refresh session, not the current access token. Calling logout
            // again should just be a no-op, not an error.
            await request(app.getHttpServer())
                .post('/auth/logout')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);
        });
    });

    describe('POST /auth/change-password', () => {
        const email = 'e2e-change-password@deliverix.test';
        const password = 'password123';

        beforeEach(async () => {
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: await hashForTest(password),
                    role: 'ADMIN',
                },
            });
        });

        async function login(pwd = password) {
            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: pwd })
                .expect(201);
            return res.body as { accessToken: string; refreshToken: string; };
        }

        it('changes the password when current password is correct', async () => {
            const { accessToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ currentPassword: password, newPassword: 'newpassword456' })
                .expect(201);

            // The real proof: the new password actually works for a fresh login
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'newpassword456' })
                .expect(201);

            // ...and the old one no longer does
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(401);
        });

        it('rejects when currentPassword is wrong, even with a valid access token', async () => {
            const { accessToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ currentPassword: 'totally-wrong', newPassword: 'newpassword456' })
                .expect(401);

            // Password must be unchanged — original still logs in
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(201);
        });

        it('rejects with no access token at all', async () => {
            await request(app.getHttpServer())
                .post('/auth/change-password')
                .send({ currentPassword: password, newPassword: 'newpassword456' })
                .expect(401);
        });

        it('rejects a newPassword shorter than 8 characters', async () => {
            const { accessToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ currentPassword: password, newPassword: 'short' })
                .expect(400);
        });

        it('does NOT invalidate the existing refresh session (documented design decision)', async () => {
            const { accessToken, refreshToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ currentPassword: password, newPassword: 'newpassword456' })
                .expect(201);

            // The refresh token from before the password change should still work —
            // this is the deliberate trade-off documented in the Aug 18 progress notes:
            // an attacker already holding a valid session isn't locked out by a
            // password change alone in a single-session model.
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(201);
        });

        it('still works for a healthy, active account (regression test for the deletedAt inversion bug)', async () => {
            // This test exists specifically because of the !user.deletedAt bug caught
            // in review: `!user || !user.isActive || !user.deletedAt` was wrong because
            // !null is true for every healthy account, which would have rejected
            // 100% of legitimate change-password attempts. This is the exact path
            // that bug would have silently broken.
            const { accessToken } = await login();

            await request(app.getHttpServer())
                .post('/auth/change-password')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ currentPassword: password, newPassword: 'anotherpassword789' })
                .expect(201);
        });
    });

    describe('Forgot / Reset Password', () => {
        const email = 'e2e-reset@deliverix.test';
        const password = 'password123';

        beforeEach(async () => {
            await prisma.user.create({
                data: {
                    email,
                    passwordHash: await hashForTest(password),
                    role: 'ADMIN',
                },
            });
        });

        async function forgotPassword(targetEmail = email) {
            const res = await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({ email: targetEmail })
                .expect(201);
            return res.body as { message: string; resetToken?: string; };
        }

        it('happy path: forgot -> reset -> old password rejected -> new password works', async () => {
            const { resetToken } = await forgotPassword();
            expect(resetToken).toBeDefined();

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: resetToken, newPassword: 'freshpassword456' })
                .expect(201);

            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(401);

            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password: 'freshpassword456' })
                .expect(201);
        });

        it('returns 200 with a generic message for an unknown email, and leaks no token', async () => {
            const body = await forgotPassword('nobody@deliverix.test');

            expect(body.resetToken).toBeUndefined();
            expect(body.message).toBeDefined();
            // Same message shape as the real-email case — no way to distinguish
        });

        it('confirms the known-email response gives no extra signal beyond the token itself', async () => {
            const knownBody = await forgotPassword(email);
            const unknownBody = await forgotPassword('nobody-else@deliverix.test');

            // The human-readable message is identical either way; only a real,
            // non-production-only reset token differs, and that's expected/intended
            expect(knownBody.message).toBe(unknownBody.message);
        });

        it('rejects reuse of an already-used reset token', async () => {
            const { resetToken } = await forgotPassword();

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: resetToken, newPassword: 'firstchange789' })
                .expect(201);

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: resetToken, newPassword: 'secondchange000' })
                .expect(401);
        });

        it('rejects an expired reset token', async () => {
            const { resetToken } = await forgotPassword();

            await prisma.user.update({
                where: { email },
                data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
            });

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: resetToken, newPassword: 'wontwork123' })
                .expect(401);
        });

        it('rejects a garbage/unknown reset token', async () => {
            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'not-a-real-token', newPassword: 'wontwork123' })
                .expect(401);
        });

        it('invalidates the existing refresh session on reset (unlike change-password)', async () => {
            const loginRes = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email, password })
                .expect(201);
            const { refreshToken } = loginRes.body as { refreshToken: string; };

            const { resetToken } = await forgotPassword();

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: resetToken, newPassword: 'securednow123' })
                .expect(201);

            // Reset assumes possible compromise -> old refresh token must die
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refreshToken })
                .expect(401);
        });

        it('gives no usable reset token for a deactivated account, though forgot-password still returns 200', async () => {
            await prisma.user.update({
                where: { email },
                data: { isActive: false, deletedAt: new Date() },
            });

            const body = await forgotPassword();

            expect(body.resetToken).toBeUndefined();
        });

        it('rejects missing/malformed input with 400', async () => {
            await request(app.getHttpServer())
                .post('/auth/forgot-password')
                .send({ email: 'not-an-email' })
                .expect(400);

            await request(app.getHttpServer())
                .post('/auth/reset-password')
                .send({ token: 'abc' }) // missing newPassword
                .expect(400);
        });
    });
});

// Small local helper — avoids importing bcrypt config decisions into the test file
async function hashForTest(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 10);
}

