import { Test, type TestingModule } from "@nestjs/testing"
import { type INestApplication, ValidationPipe } from "@nestjs/common"
import request from "supertest"
import { AppModule } from "../src/app.module"
import { PrismaService } from "../src/prisma/prisma.service"
import { cleanDatabase } from "./utils/db-cleanup"
import { createTenant, createUserFixture, loginAs } from "./utils/fixtures"

let tenant: Awaited<ReturnType<typeof createTenant>>

interface LoginResponse {
  accessToken: string
  refreshToken: string
}

interface ForgotPasswordResponse {
  message: string
  resetToken?: string
}

interface AuthMeResponse {
  userId: string
  role: string
  companyId: string
  hubId: string | null
}

describe("Auth (e2e)", () => {
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

  describe("POST /auth/login", () => {
    const email = "e2e-login@deliverix.test"
    const password = "password123"

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashForTest(password),
          role: "ADMIN",
          fullName: "Test ADMIN",
          company: { connect: { id: tenant.company.id } },
        },
      })
    })

    it("logs in with correct credentials and returns both tokens", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password })
        .expect(201)

      expect(res.body).toHaveProperty("accessToken")
      expect(res.body).toHaveProperty("refreshToken")
      expect(typeof res.body.accessToken).toBe("string")
    })

    it("rejects a wrong password with 401", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: "wrong-password" })
        .expect(401)
    })

    it("rejects an unknown email with 401 (not 404 — no enumeration)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "nobody@deliverix.test", password: "anything" })
        .expect(401)

      expect(res.body.message as string).toBe("Invalid credentials")
    })

    it("rejects malformed input with 400", async () => {
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "not-an-email", password: "" })
        .expect(400)
    })

    it("strips unknown fields instead of erroring (whitelist behavior)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password, isAdmin: true })
        .expect(201)

      expect(res.body).not.toHaveProperty("isAdmin")
    })
  })

  describe("POST /auth/refresh", () => {
    const email = "e2e-refresh@deliverix.test"
    const password = "password123"

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashForTest(password),
          role: "ADMIN",
          fullName: "Test ADMIN",
          company: { connect: { id: tenant.company.id } },
        },
      })
    })

    async function login() {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password })
        .expect(201)
      return res.body as LoginResponse
    }

    it("issues a new token pair from a valid refresh token", async () => {
      const { refreshToken } = await login()

      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(201)

      expect(res.body).toHaveProperty("accessToken")
      expect(res.body).toHaveProperty("refreshToken")
      expect(res.body.refreshToken as string).not.toBe(refreshToken)
    })

    it("rejects reuse of an already-rotated refresh token", async () => {
      const { refreshToken: tokenA } = await login()

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: tokenA })
        .expect(201)

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: tokenA })
        .expect(401)
    })

    it("allows the newly rotated token to be used", async () => {
      const { refreshToken: tokenA } = await login()

      const { body: rotated } = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: tokenA })
        .expect(201)

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: (rotated as LoginResponse).refreshToken })
        .expect(201)
    })

    it("rejects a garbage/unknown refresh token", async () => {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: "not-a-real-token" })
        .expect(401)
    })

    it("rejects a missing refreshToken field with 400", async () => {
      await request(app.getHttpServer()).post("/auth/refresh").send({}).expect(400)
    })

    it("rejects an expired refresh token", async () => {
      const { refreshToken } = await login()

      await prisma.user.update({
        where: { email },
        data: { refreshTokenExpiresAt: new Date(Date.now() - 1000) },
      })

      await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401)
    })
  })

  describe("POST /auth/logout", () => {
    const email = "e2e-logout@deliverix.test"
    const password = "password123"

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashForTest(password),
          role: "ADMIN",
          fullName: "Test ADMIN",
          company: { connect: { id: tenant.company.id } },
        },
      })
    })

    async function login() {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password })
        .expect(201)
      return res.body as LoginResponse
    }

    it("clears the refresh session so the old refresh token stops working", async () => {
      const { accessToken, refreshToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(201)

      await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401)
    })

    it("rejects logout with no access token at all", async () => {
      await request(app.getHttpServer()).post("/auth/logout").expect(401)
    })

    it("rejects logout with a garbage access token", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", "Bearer not-a-real-jwt")
        .expect(401)
    })

    it("is safe to call twice in a row (second call still authenticated, still succeeds)", async () => {
      const { accessToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(201)

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(201)
    })
  })

  describe("POST /auth/change-password", () => {
    const email = "e2e-change-password@deliverix.test"
    const password = "password123"

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashForTest(password),
          role: "ADMIN",
          fullName: "Test ADMIN",
          company: { connect: { id: tenant.company.id } },
        },
      })
    })

    async function login(pwd = password) {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: pwd })
        .expect(201)
      return res.body as LoginResponse
    }

    it("changes the password when current password is correct", async () => {
      const { accessToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: password, newPassword: "newpassword456" })
        .expect(201)

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: "newpassword456" })
        .expect(201)

      await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(401)
    })

    it("rejects when currentPassword is wrong, even with a valid access token", async () => {
      const { accessToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "totally-wrong",
          newPassword: "newpassword456",
        })
        .expect(401)

      await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(201)
    })

    it("rejects with no access token at all", async () => {
      await request(app.getHttpServer())
        .post("/auth/change-password")
        .send({ currentPassword: password, newPassword: "newpassword456" })
        .expect(401)
    })

    it("rejects a newPassword shorter than 8 characters", async () => {
      const { accessToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: password, newPassword: "short" })
        .expect(400)
    })

    it("does NOT invalidate the existing refresh session", async () => {
      const { accessToken, refreshToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: password, newPassword: "newpassword456" })
        .expect(201)

      await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(201)
    })

    it("still works for a healthy, active account", async () => {
      const { accessToken } = await login()

      await request(app.getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: password, newPassword: "anotherpassword789" })
        .expect(201)
    })
  })

  describe("Forgot / Reset Password", () => {
    const email = "e2e-reset@deliverix.test"
    const password = "password123"

    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashForTest(password),
          role: "ADMIN",
          fullName: "Test ADMIN",
          company: { connect: { id: tenant.company.id } },
        },
      })
    })

    async function forgotPassword(targetEmail = email): Promise<ForgotPasswordResponse> {
      const res = await request(app.getHttpServer())
        .post("/auth/forgot-password")
        .send({ email: targetEmail })
        .expect(201)
      return res.body as ForgotPasswordResponse
    }

    it("happy path: forgot -> reset -> old password rejected -> new password works", async () => {
      const { resetToken } = await forgotPassword()
      expect(resetToken).toBeDefined()

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: resetToken, newPassword: "freshpassword456" })
        .expect(201)

      await request(app.getHttpServer()).post("/auth/login").send({ email, password }).expect(401)

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: "freshpassword456" })
        .expect(201)
    })

    it("returns 200 with a generic message for an unknown email", async () => {
      const body = await forgotPassword("nobody@deliverix.test")

      expect(body.resetToken).toBeUndefined()
      expect(body.message).toBeDefined()
    })

    it("confirms the known-email response gives no extra signal", async () => {
      const knownBody = await forgotPassword(email)
      const unknownBody = await forgotPassword("nobody-else@deliverix.test")

      expect(knownBody.message).toBe(unknownBody.message)
    })

    it("rejects reuse of an already-used reset token", async () => {
      const { resetToken } = await forgotPassword()

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: resetToken, newPassword: "firstchange789" })
        .expect(201)

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: resetToken, newPassword: "secondchange000" })
        .expect(401)
    })

    it("rejects an expired reset token", async () => {
      const { resetToken } = await forgotPassword()

      await prisma.user.update({
        where: { email },
        data: { resetTokenExpiresAt: new Date(Date.now() - 1000) },
      })

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: resetToken, newPassword: "wontwork123" })
        .expect(401)
    })

    it("rejects a garbage/unknown reset token", async () => {
      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: "not-a-real-token", newPassword: "wontwork123" })
        .expect(401)
    })

    it("invalidates the existing refresh session on reset", async () => {
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password })
        .expect(201)
      const { refreshToken } = loginRes.body as LoginResponse

      const { resetToken } = await forgotPassword()

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: resetToken, newPassword: "securednow123" })
        .expect(201)

      await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken }).expect(401)
    })

    it("gives no usable reset token for a deactivated account", async () => {
      await prisma.user.update({
        where: { email },
        data: { isActive: false, deletedAt: new Date() },
      })

      const body = await forgotPassword()

      expect(body.resetToken).toBeUndefined()
    })

    it("rejects missing/malformed input with 400", async () => {
      await request(app.getHttpServer())
        .post("/auth/forgot-password")
        .send({ email: "not-an-email" })
        .expect(400)

      await request(app.getHttpServer())
        .post("/auth/reset-password")
        .send({ token: "abc" })
        .expect(400)
    })
  })

  describe("Access token revocation", () => {
    async function setup() {
      const target = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: "ADMIN",
      })
      const actor = await createUserFixture(prisma, {
        companyId: tenant.company.id,
        role: "ADMIN",
      })
      return {
        target,
        targetTokens: await loginAs(app, target.email, target.password),
        actorTokens: await loginAs(app, actor.email, actor.password),
      }
    }

    it("GET /auth/me returns userId, role, companyId, hubId", async () => {
      const { target, targetTokens } = await setup()
      const res = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${targetTokens.accessToken}`)
        .expect(200)
      expect(res.body).toEqual({
        userId: target.user.id,
        role: "ADMIN",
        companyId: tenant.company.id,
        hubId: null,
      })
    })

    it("deactivated user token is rejected immediately", async () => {
      const { target, targetTokens, actorTokens } = await setup()
      await request(app.getHttpServer())
        .patch(`/users/${target.user.id}`)
        .set("Authorization", `Bearer ${actorTokens.accessToken}`)
        .send({ isActive: false })
        .expect(200)
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${targetTokens.accessToken}`)
        .expect(401)
    })

    it("soft-deleted user token is rejected immediately", async () => {
      const { target, targetTokens, actorTokens } = await setup()
      await request(app.getHttpServer())
        .delete(`/users/${target.user.id}`)
        .set("Authorization", `Bearer ${actorTokens.accessToken}`)
        .expect(200)
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${targetTokens.accessToken}`)
        .expect(401)
    })
  })

  it("GET /auth/me returns user payload with company and hub after login", async () => {
    await prisma.user.create({
      data: {
        email: "e2e-me@deliverix.test",
        passwordHash: await hashForTest("password123"),
        role: "ADMIN",
        fullName: "Test ADMIN",
        companyId: tenant.company.id,
      },
    })

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "e2e-me@deliverix.test", password: "password123" })
      .expect(201)
    const accessToken = loginRes.body.accessToken as string

    const dbUser = await prisma.user.findFirst({
      where: { email: "e2e-me@deliverix.test" },
    })

    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    expect(res.body).toEqual({
      userId: dbUser.id,
      role: "ADMIN",
      companyId: tenant.company.id,
      hubId: null,
    })
  })
})

async function hashForTest(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.hash(password, 10)
}
