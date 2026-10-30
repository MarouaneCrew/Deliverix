import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { User, City, Hub, Company } from '../src/generated/prisma/client';

export function createCompany(prisma: PrismaClient, name = 'Test Co') {
  return prisma.company.create({
    data: { name },
    select: { id: true, name: true },
  }) as Promise<Company>;
}

export function createCity(
  prisma: PrismaClient,
  name = `Testville-${Date.now()}-${Math.random().toString(36).slice(2)}`,
) {
  return prisma.city.create({
    data: { name },
    select: { id: true, name: true },
  }) as Promise<City>;
}

export function createHub(
  prisma: PrismaClient,
  {
    companyId,
    cityId,
    name = 'Test Hub',
  }: { companyId: string; cityId: string; name?: string },
) {
  return prisma.hub.create({
    data: { companyId, cityId, name },
    select: { id: true, name: true, cityId: true },
  }) as Promise<Hub>;
}

export async function createTenant(prisma: PrismaClient) {
  const company = await createCompany(prisma);
  const city = await createCity(prisma);
  const hub = await createHub(prisma, {
    companyId: company.id,
    cityId: city.id,
  });
  return { company, city, hub };
}

export async function createUserFixture(
  prisma: PrismaClient,
  {
    companyId,
    role,
    hubId = null,
    email,
    password = 'password123',
  }: {
    companyId: string;
    role: string;
    hubId?: string | null;
    email?: string;
    password?: string;
  },
) {
  const defaultEmail =
    email ||
    `e2e-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@deliverix.test`;
  const passwordHash = await hash(password, 4);

  const user = await prisma.user.create({
    data: {
      email: defaultEmail,
      passwordHash,
      fullName: 'Test User',
      role: role as any,
      companyId,
      hubId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      hubId: true,
    },
  });

  return { user, email: defaultEmail, password };
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
