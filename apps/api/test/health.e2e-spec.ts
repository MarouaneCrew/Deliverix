import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /health -> 200 { status: "ok" }', async () => {
        await request(app.getHttpServer())
            .get('/health')
            .expect(200)
            .expect({ status: 'ok' });
    });

    it('response has non-empty x-request-id header', async () => {
        const res = await request(app.getHttpServer())
            .get('/health')
            .expect(200);

        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    it('sending x-request-id: abc-123 echoes same value', async () => {
        const res = await request(app.getHttpServer())
            .get('/health')
            .set('x-request-id', 'abc-123')
            .expect(200);

        expect(res.headers['x-request-id']).toBe('abc-123');
    });

    it('invalid x-request-id characters -> generated UUID format', async () => {
        const res = await request(app.getHttpServer())
            .get('/health')
            .set('x-request-id', 'bad value!!')
            .expect(200);

        const requestId = res.headers['x-request-id'];
        expect(requestId).not.toBe('bad value!!');
        expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
});