import { PrismaClient } from '../../src/generated/prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function createCompany(prisma: PrismaClient, name = 'Test Co') {
  return prisma.company.upsert({
    where: { id: 'test-company-' + name },
    create: { id: 'test-company-' + name, name },
    update: { name },
  });
}

export async function createCity(prisma: PrismaClient, name = 'Testville') {
  return prisma.city.upsert({
    where: { name },
    create: { id: 'test-city-' + name, name },
    update: { name },
  });
}

export async function createHub(
  prisma: PrismaClient,
  {
    companyId,
    cityId,
    name = 'Test Hub',
  }: { companyId: string; cityId: string; name?: string },
) {
  return prisma.hub.upsert({
    where: { id: 'test-hub-' + name },
    create: { id: 'test-hub-' + name, name, companyId, cityId },
    update: { name },
  });
}

export async function createTenant(prisma: PrismaClient, suffix = '') {
  const company = await createCompany(prisma, `Test Co${suffix}`);
  const city = await createCity(prisma, `Testville${suffix}`);
  const hub = await createHub(prisma, {
    companyId: company.id,
    cityId: city.id,
    name: `Test Hub${suffix}`,
  });
  return { company, city, hub };
}

export async function createUserFixture(
  prisma: PrismaClient,
  {
    companyId,
    role,
    hubId = null,
    email: emailOverride,
    password = 'password123',
  }: {
    companyId: string;
    role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
    hubId?: string | null;
    emailOverride?: string;
    password?: string;
  },
) {
  const email: string =
    emailOverride ??
    `e2e-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@deliverix.test`;
  const hashed = await hash(password, 4);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashed,
      role: role,
      companyId,
      hubId,
      fullName: `Test ${role}`,
    },
  });

  return { user, email, password } as const;
}

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return res.body as { accessToken: string; refreshToken: string };
}
