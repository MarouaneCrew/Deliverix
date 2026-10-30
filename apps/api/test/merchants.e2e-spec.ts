import { Test, type TestingModule } from "@nestjs/testing"
import { type INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { PrismaService } from "../src/prisma/prisma.service"
import { cleanDatabase } from "./utils/db-cleanup"
import { createTenant, createUserFixture, loginAs } from "./utils/fixtures"

let tenant: Awaited<ReturnType<typeof createTenant>>

describe("Merchants (e2e)", () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await cleanDatabase(prisma)
    tenant = await createTenant(prisma)
  })

  // 1. DISPATCHER creates merchant (no login)
  it("DISPATCHER creates merchant (no login)", async () => {
    const dispatcher = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "DISPATCHER",
      hubId: tenant.hub.id,
    })
    const { accessToken } = await loginAs(app, dispatcher.email, dispatcher.password)

    const res = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    expect(res.body).toMatchObject({
      name: "Test Merchant",
      cityId: tenant.city.id,
      hasLogin: false,
    })
  })

  // 2. ADMIN creates merchant
  it("ADMIN creates merchant", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    const res = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Admin Merchant",
        cityId: tenant.city.id,
        phone: "+212539999999",
        address: "123 Main St",
      })
      .expect(201)

    expect(res.body).toMatchObject({
      name: "Admin Merchant",
      cityId: tenant.city.id,
      phone: "+212539999999",
      address: "123 Main St",
      hasLogin: false,
    })
  })

  // 3. DRIVER / MERCHANT POST /merchants -> 403
  it("DRIVER POST /merchants -> 403", async () => {
    const driver = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "DRIVER",
      hubId: tenant.hub.id,
    })
    const { accessToken } = await loginAs(app, driver.email, driver.password)

    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(403)
  })

  it("MERCHANT POST /merchants -> 403", async () => {
    const merchantUser = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "MERCHANT",
    })
    const { accessToken } = await loginAs(app, merchantUser.email, merchantUser.password)

    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(403)
  })

  // 4. Unknown cityId -> 404
  it("unknown cityId -> 404", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: "non-existent-id",
      })
      .expect(404)
  })

  // 5. Invalid phone -> 400
  it("invalid phone -> 400", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
        phone: "abc",
      })
      .expect(400)
  })

  // 6. Attach account to merchant
  it("attach account to merchant", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    const attachRes = await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "merchant-login@test.com",
        password: "password123",
      })
      .expect(201)

    expect(attachRes.body).toMatchObject({
      merchantId,
      email: "merchant-login@test.com",
    })

    // Verify the merchant can login
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "merchant-login@test.com",
        password: "password123",
      })
      .expect(201)
  })

  // 7. Attach account twice -> 409
  it("attach account twice -> 409", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "merchant-login@test.com",
        password: "password123",
      })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "merchant-login@test.com",
        password: "password123",
      })
      .expect(409)
  })

  // 8. Attach account with existing email -> 409
  it("attach account with an email already used -> 409", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant 1",
        cityId: tenant.city.id,
      })
      .expect(201)

    const createRes2 = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant 2",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchant2Id = createRes2.body.id

    await request(app.getHttpServer())
      .post(`/merchants/${merchant2Id}/account`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: admin.email,
        password: "password123",
      })
      .expect(409)
  })

  // 9. Merchant user GET /merchants/me -> 200, own record
  it("merchant user GET /merchants/me -> 200, own record", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken: adminToken } = await loginAs(app, admin.email, admin.password)

    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    // Attach account to merchant
    await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "merchant@test.com",
        password: "password123",
      })
      .expect(201)

    // Login as merchant
    const merchantLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "merchant@test.com",
        password: "password123",
      })
      .expect(201)

    // GET /merchants/me as merchant
    await request(app.getHttpServer())
      .get("/merchants/me")
      .set("Authorization", `Bearer ${merchantLogin.body.accessToken}`)
      .expect(200)
      .expect(res => {
        expect(res.body.id).toBe(merchantId)
        expect(res.body.name).toBe("Test Merchant")
      })
  })

  // 10. Merchant user GET /merchants/:id of another merchant -> 404
  it("merchant user GET /merchants/:id of another merchant -> 404", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken: adminToken } = await loginAs(app, admin.email, admin.password)

    const createRes1 = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Merchant 1",
        cityId: tenant.city.id,
      })
      .expect(201)

    const createRes2 = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Merchant 2",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchant1Id = createRes1.body.id
    const merchant2Id = createRes2.body.id

    // Attach account to merchant 1
    await request(app.getHttpServer())
      .post(`/merchants/${merchant1Id}/account`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "merchant1@test.com",
        password: "password123",
      })
      .expect(201)

    // Login as merchant 1
    const merchant1Login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "merchant1@test.com",
        password: "password123",
      })
      .expect(201)

    // GET merchant 2 as merchant 1 -> 404
    await request(app.getHttpServer())
      .get(`/merchants/${merchant2Id}`)
      .set("Authorization", `Bearer ${merchant1Login.body.accessToken}`)
      .expect(404)
  })

  // 11. Merchant user GET /merchants -> 403 (not allowed)
  it("merchant user GET /merchants -> 403 (only /me allowed)", async () => {
    const merchantUser = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "MERCHANT",
    })
    const { accessToken } = await loginAs(app, merchantUser.email, merchantUser.password)

    await request(app.getHttpServer())
      .get("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403)
  })

  // 12. DISPATCHER DELETE /merchants/:id -> 403
  it("DISPATCHER DELETE /merchants/:id -> 403", async () => {
    const dispatcher = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "DISPATCHER",
      hubId: tenant.hub.id,
    })
    const { accessToken } = await loginAs(app, dispatcher.email, dispatcher.password)

    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    await request(app.getHttpServer())
      .delete(`/merchants/${merchantId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403)
  })

  // 13. ADMIN deletes merchant with login -> merchant gone; login -> 401
  it("ADMIN deletes merchant with login -> merchant gone; login -> 401", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    // Attach account
    await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "merchant-delete@test.com",
        password: "password123",
      })
      .expect(201)

    // Login works before delete
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "merchant-delete@test.com",
        password: "password123",
      })
      .expect(201)

    // Delete merchant
    await request(app.getHttpServer())
      .delete(`/merchants/${merchantId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    // Login no longer works
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "merchant-delete@test.com",
        password: "password123",
      })
      .expect(401)

    // Merchant not in list
    const listRes = await request(app.getHttpServer())
      .get("/merchants")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    const merchants = listRes.body as { id: string }[]
    expect(merchants.find(m => m.id === merchantId)).toBeUndefined()
  })

  // 14. Tenancy tests
  it("tenancy: GET /merchants/:id for another company -> 404", async () => {
    const admin1 = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken: token1 } = await loginAs(app, admin1.email, admin1.password)

    // Create merchant in tenant A
    const createRes = await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        name: "Tenant A Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    const merchantId = createRes.body.id

    // Create second tenant
    const tenantB = await createTenant(prisma)
    const admin2 = await createUserFixture(prisma, {
      companyId: tenantB.company.id,
      role: "ADMIN",
    })
    const { accessToken: token2 } = await loginAs(app, admin2.email, admin2.password)

    // Tenant B tries to GET tenant A merchant -> 404
    await request(app.getHttpServer())
      .get(`/merchants/${merchantId}`)
      .set("Authorization", `Bearer ${token2}`)
      .expect(404)

    // Tenant B tries to PATCH tenant A merchant -> 404
    await request(app.getHttpServer())
      .patch(`/merchants/${merchantId}`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ name: "Hacked" })
      .expect(404)

    // Tenant B tries to POST /merchants/:id/account for tenant A merchant -> 404
    await request(app.getHttpServer())
      .post(`/merchants/${merchantId}/account`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ email: "hacked@test.com", password: "password123" })
      .expect(404)
  })

  // 15. GET /merchants returns only own company's
  it("GET /merchants returns only own company merchants", async () => {
    const admin1 = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken: token1 } = await loginAs(app, admin1.email, admin1.password)

    // Create merchant in tenant A
    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        name: "Tenant A Merchant",
        cityId: tenant.city.id,
      })
      .expect(201)

    // Create second tenant
    const tenantB = await createTenant(prisma)
    const admin2 = await createUserFixture(prisma, {
      companyId: tenantB.company.id,
      role: "ADMIN",
    })
    const { accessToken: token2 } = await loginAs(app, admin2.email, admin2.password)

    // Create merchant in tenant B
    await request(app.getHttpServer())
      .post("/merchants")
      .set("Authorization", `Bearer ${token2}`)
      .send({
        name: "Tenant B Merchant",
        cityId: tenantB.city.id,
      })
      .expect(201)

    // Tenant A should only see tenant A merchant
    const listResA = await request(app.getHttpServer())
      .get("/merchants")
      .set("Authorization", `Bearer ${token1}`)
      .expect(200)
    expect(listResA.body.length).toBe(1)
    expect(listResA.body[0].name).toBe("Tenant A Merchant")

    // Tenant B should only see tenant B merchant
    const listResB = await request(app.getHttpServer())
      .get("/merchants")
      .set("Authorization", `Bearer ${token2}`)
      .expect(200)
    expect(listResB.body.length).toBe(1)
    expect(listResB.body[0].name).toBe("Tenant B Merchant")
  })

  // 16. GET /merchants/me by non-MERCHANT -> 403
  it("GET /merchants/me by non-MERCHANT role -> 403", async () => {
    const admin = await createUserFixture(prisma, {
      companyId: tenant.company.id,
      role: "ADMIN",
    })
    const { accessToken } = await loginAs(app, admin.email, admin.password)

    await request(app.getHttpServer())
      .get("/merchants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403)
  })
})
