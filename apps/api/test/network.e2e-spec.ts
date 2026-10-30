import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './utils/db-cleanup';
import { createTenant, createUserFixture, loginAs } from './utils/fixtures';
import { UserRole } from '../src/generated/prisma/enums';

let tenant: Awaited<ReturnType<typeof createTenant>>;

interface CreateCityResponse {
  id: string;
  name: string;
}

interface CreateHubResponse {
  id: string;
  name: string;
  cityId: string;
  city: { id: string; name: string };
  address?: string | null;
  isActive: boolean;
}

interface CityResponse {
  id: string;
  name: string;
}

interface HubResponse {
  id: string;
  name: string;
  cityId: string;
  city: { id: string; name: string };
  address?: string | null;
  isActive: boolean;
  createdAt: string;
}

describe('Network (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
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

  async function createAdminUser() {
    const { email } = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: UserRole.ADMIN,
    });
    const loginRes = await loginAs(app, email, 'password123');
    return { email, accessToken: loginRes.accessToken };
  }

  // ==================== CITY TESTS ====================

  describe('POST /cities', () => {
    it('ADMIN creates city', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test City' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Test City',
      });
    });

    it('duplicate city (case-insensitive) returns 409', async () => {
      const { accessToken } = await createAdminUser();

      await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Casablanca' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'casablanca' })
        .expect(409);
    });

    it('DISPATCHER POST /cities returns 403', async () => {
      const dispatcher = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: UserRole.DISPATCHER,
      });
      const { accessToken } = await loginAs(
        app,
        dispatcher.email,
        'password123',
      );

      await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test City' })
        .expect(403);
    });

    it('no token returns 401', async () => {
      await request(app.getHttpServer())
        .post('/cities')
        .send({ name: 'Test City' })
        .expect(401);
    });
  });

  describe('GET /cities', () => {
    it('DISPATCHER can list cities', async () => {
      const dispatcher = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: UserRole.DISPATCHER,
      });
      const { accessToken } = await loginAs(
        app,
        dispatcher.email,
        'password123',
      );

      const res = await request(app.getHttpServer())
        .get('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(0);
    });

    it('DRIVER can list cities', async () => {
      const driver = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: UserRole.DRIVER,
      });
      const { accessToken } = await loginAs(app, driver.email, 'password123');

      await request(app.getHttpServer())
        .get('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('MERCHANT can list cities', async () => {
      const merchant = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: UserRole.MERCHANT,
      });
      const { accessToken } = await loginAs(app, merchant.email, 'password123');

      await request(app.getHttpServer())
        .get('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('GET /cities/:id returns city', async () => {
      const { accessToken } = await createAdminUser();

      const createRes = await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Rabat' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/cities/${(createRes.body as CreateCityResponse).id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.name).toBe('Rabat');
    });

    it('GET /cities/:id unknown id returns 404', async () => {
      const { accessToken } = await createAdminUser();

      await request(app.getHttpServer())
        .get('/cities/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /cities/:id', () => {
    it('PATCH city name', async () => {
      const { accessToken } = await createAdminUser();

      const createRes = await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Marrakech' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/cities/${(createRes.body as CreateCityResponse).id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated City' })
        .expect(200);

      expect(res.body.name).toBe('Updated City');
    });
  });

  // ==================== HUB TESTS ====================

  describe('POST /hubs', () => {
    it('ADMIN creates hub', async () => {
      const { accessToken } = await createAdminUser();

      const res = await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Test Hub 1',
          address: '123 Test St',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Hub 1',
        cityId: tenant.city.id,
        city: { id: tenant.city.id, name: tenant.city.name },
      });
    });

    it('hub with unknown cityId returns 404', async () => {
      const { accessToken } = await createAdminUser();

      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: 'does-not-exist',
          name: 'Test Hub 2',
        })
        .expect(404);
    });

    it('duplicate hub name in same company returns 409', async () => {
      const { accessToken } = await createAdminUser();

      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Duplicate Hub',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Duplicate Hub',
        })
        .expect(409);
    });

    it('same hub name in different company returns 201', async () => {
      const { accessToken } = await createAdminUser();

      // Create hub for first tenant
      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Same Name Hub A',
        })
        .expect(201);

      // Create second tenant
      const secondTenant = await createTenant(prisma, ' B');

      const { email: secondAdminEmail } = await createUserFixture(prisma, {
        companyId: secondTenant.company.id,
        role: UserRole.ADMIN,
      });
      const { accessToken: secondToken } = await loginAs(
        app,
        secondAdminEmail,
        'password123',
      );

      // Same hub name for second tenant should succeed
      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${secondToken}`)
        .send({
          cityId: secondTenant.city.id,
          name: 'Same Name Hub A',
        })
        .expect(201);
    });

    it('DISPATCHER POST /hubs returns 403', async () => {
      const dispatcher = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: UserRole.DISPATCHER,
      });
      const { accessToken } = await loginAs(
        app,
        dispatcher.email,
        'password123',
      );

      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Test Hub 3',
        })
        .expect(403);
    });
  });

  describe('GET /hubs', () => {
    it('GET /hubs returns only own company hubs (two tenants)', async () => {
      const { accessToken } = await createAdminUser();

      // Create second tenant with its own hub
      const secondTenant = await createTenant(prisma, ' B');
      const { email: secondAdminEmail } = await createUserFixture(prisma, {
        companyId: secondTenant.company.id,
        role: UserRole.ADMIN,
      });
      const { accessToken: secondAdminToken } = await loginAs(
        app,
        secondAdminEmail,
        'password123',
      );

      await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .send({
          cityId: secondTenant.city.id,
          name: 'Second Tenant Hub',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should only see tenant's hubs, not second tenant's
      expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(1);
      expect(res.body).not.toContainEqual(
        expect.objectContaining({ name: 'Second Tenant Hub' }),
      );
    });

    it('GET /hubs/:id of another company returns 404', async () => {
      const { accessToken } = await createAdminUser();

      const secondTenant = await createTenant(prisma, ' B');

      await request(app.getHttpServer())
        .get(`/hubs/${secondTenant.hub.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /hubs/:id', () => {
    it('PATCH hub isActive: false', async () => {
      const { accessToken } = await createAdminUser();

      const createRes = await request(app.getHttpServer())
        .post('/hubs')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cityId: tenant.city.id,
          name: 'Test Hub 4',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/hubs/${(createRes.body as CreateHubResponse).id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });

    it('PATCH hub of another company returns 404', async () => {
      const { accessToken } = await createAdminUser();

      const secondTenant = await createTenant(prisma, ' B');

      await request(app.getHttpServer())
        .patch(`/hubs/${secondTenant.hub.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('Validation', () => {
    it('blank/whitespace-only city name returns 400', async () => {
      const { accessToken } = await createAdminUser();

      await request(app.getHttpServer())
        .post('/cities')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '   ' })
        .expect(400);
    });
  });
});
