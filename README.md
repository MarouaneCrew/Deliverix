# Deliverix

**A logistics SaaS platform for Moroccan e-commerce delivery companies — built from business discovery through production, one deliberate stage at a time.**

Deliverix is not a CRUD portfolio project. It's a simulation of building a real logistics product: business discovery → domain modeling → requirements → API design → implementation → testing, with architectural complexity introduced only when the business actually creates the problem that complexity solves.

---

## Table of contents

- [About](#about)
- [Who this is for](#who-this-is-for)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Current status](#current-status)
- [Getting started](#getting-started)
- [Running tests](#running-tests)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Security](#security)
- [Roadmap](#roadmap)
- [Engineering principles](#engineering-principles)

---

## About

Deliverix targets **Moroccan e-commerce delivery companies** — not gig-economy couriers, not marketplaces. The operational model it's built around:

```
E-commerce merchant → Delivery company → Dispatcher → Company-employed driver → Receiver
```

Delivery companies in this market own or manage their fleets, and drivers are **employees**, not freelance couriers who accept or reject jobs. That single fact shaped a real product decision early on: dispatchers *assign* work, drivers don't get an accept/reject step. Cash-on-delivery (COD) is a first-class domain concern, not an afterthought, because it's central to how delivery operates in this market.

The core domain:

```
Merchant → creates → Parcel → assigned through → Assignment → Driver
                        │
                        ├── DeliveryAttempt
                        ├── PaymentCollection (COD)
                        └── Tracking
```

Authentication and user management exist to *support* this domain — they are not the product.

## Who this is for

If you're reading this as a contributor or reviewer: this repo is deliberately incremental. Each stage is implemented, tested, and closed out before the next one starts. You won't find Kafka, Redis, microservices, or CQRS here yet — not because they're unknown, but because nothing in the current system justifies them yet. See [Engineering principles](#engineering-principles).

## Tech stack

| Layer | Choice |
|---|---|
| Backend framework | [NestJS](https://nestjs.com/) (TypeScript) |
| ORM | [Prisma 7](https://www.prisma.io/) with the `pg` driver adapter |
| Database | PostgreSQL 17 |
| Auth | JWT (access tokens) + opaque rotating refresh tokens, via Passport |
| Password hashing | bcrypt |
| Rate limiting | `@nestjs/throttler` |
| Containerization | Docker Compose (PostgreSQL) |
| Frontend (planned, Stage 7) | Angular |
| Testing | Jest + Supertest (e2e), against a dedicated test database |

**Why Prisma 7, specifically:** it introduces a new client generation model (`provider = "prisma-client"` instead of `prisma-client-js`) and moves datasource configuration out of `schema.prisma` into `prisma.config.ts`. The project uses the PostgreSQL driver adapter (`@prisma/adapter-pg`) rather than Prisma's default connection handling.

## Architecture

**Modular monolith.** One deployable NestJS application, with strong module boundaries drawn along domain lines (`AuthModule`, `UsersModule`, and — as the logistics domain lands — `MerchantsModule`, `DriversModule`, `ParcelsModule`, etc.).

```
AppModule
 ├── PrismaModule   (global — provides PrismaService everywhere)
 ├── AuthModule
 └── UsersModule
```

Request flow:

```
Client
  → ValidationPipe (whitelist: strips unknown fields)
  → ThrottlerGuard (global rate limiting)
  → JwtAuthGuard (Passport JWT strategy)
  → RolesGuard (RBAC via @Roles decorator)
  → Controller → Service → PrismaService → PostgreSQL
```

The plan is for this to evolve — Clean Architecture layering where it earns its place, then DDD, then domain events, then (potentially, not definitely) an event-driven or service-decomposed architecture — but only in response to real coupling or scale problems, not because the pattern exists.

## Current status

**Stage 2 (Authentication / Authorization / Users) is functionally complete**, including full e2e test coverage.

| Stage | Status |
|---|---|
| 0 — Discovery, domain modeling, requirements | ✅ Complete |
| 1 — Backend foundation (NestJS, Postgres, Prisma, Docker) | ✅ Complete |
| 2 — Auth / Authorization / Users | ✅ Complete (audit logs deferred, see below) |
| 3 — Merchant + Driver | ⏳ Next |
| 4–15 — Parcel core → Production → Route optimization | ⏳ Planned |

### What's implemented in Stage 2

- Login, JWT access tokens (15 min), Passport `JwtStrategy` + `JwtAuthGuard`
- Opaque, SHA-256-hashed refresh tokens with **rotation** (single-session model, 7-day absolute expiry that rotation does not reset)
- Logout (invalidates the stored refresh session)
- Password change (requires current-password verification)
- Forgot / reset password (opaque time-limited token, 1-hour expiry, forces refresh-session invalidation on use — unlike password change)
- RBAC (`ADMIN` / `DISPATCHER` / `DRIVER`) via `@Roles()` + `RolesGuard`, enforced on all `/users` routes
- Admin-controlled user creation — **no public registration in V1**; accounts are created via `POST /users` by an ADMIN
- A type-level guard (`AssignableUserRole`) preventing `ADMIN` from ever being assigned through the general-purpose user-creation/update DTOs
- Soft-delete (`isActive` + `deletedAt`) instead of hard deletion, preserving auditability
- Rate limiting: 5/min on `login` and `forgot-password`, 20/min global default
- Security hardening: startup env validation, `@nestjs/config`, shared `ROLES_KEY` constant, `trust proxy` set

**Deliberately deferred, not forgotten:**
- **Audit logs** — waiting until real domain actions (parcel status changes, assignments) exist to audit, rather than building it around user CRUD alone
- **Email verification** — explicitly out of scope for V1, since every account is Admin-vouched-for at creation; revisit only if public registration is ever introduced

## Getting started

### Prerequisites

- Node.js (LTS)
- Docker + Docker Compose
- npm

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/deliverix.git
cd deliverix/apps/api
npm install
```

### 2. Environment variables

Copy the example files and fill in real values:

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL` and `JWT_SECRET`. The app validates these on startup and will refuse to boot if they're missing.

### 3. Start PostgreSQL

From the repo root:

```bash
docker compose up -d
```

### 4. Run migrations and seed a dev admin

```bash
npx prisma migrate deploy
npx prisma generate
npm run seed
```

This creates `admin@deliverix.local` with the password defined in `seed.ts`, using an idempotent `upsert` — safe to re-run.

### 5. Run the app

```bash
npm run start:dev
```

## Running tests

Two categories exist, testing different things — see the note below if you're new to the distinction.

- **E2E tests** exercise the full request pipeline — real HTTP, real guards/pipes, real PostgreSQL — against a dedicated test database that is never your dev database.
- **Rate-limit tests** run separately from the rest of the e2e suite, deliberately using production-realistic throttle limits (the rest of the suite inflates them via env vars, so normal test traffic doesn't trip the limiter).

### One-time test DB setup

```bash
docker exec -it deliverix-postgres psql -U <POSTGRES_USER> -c "CREATE DATABASE deliverix_test;"
cp .env.test.example .env.test   # fill in DATABASE_URL pointing at deliverix_test
npm run test:e2e:migrate
```

### Run everything

```bash
npm run test:e2e:all
```

This runs the main e2e suite (auth + users, 52 tests) followed by the standalone throttling suite (3 tests) — 55 tests total, covering login, refresh rotation (including reuse-rejection and expiry), logout, password change, forgot/reset password, `/auth/me`, full `users` CRUD with RBAC enforcement, and rate limiting.

> **A note on why e2e tests hit a real database:** these tests aren't testing isolated logic (that's what unit tests are for) — they're proving the whole pipeline actually works together. Several real bugs in this codebase (a mispasted DTO that silently stripped `refreshToken` from requests; an inverted `deletedAt` check that would have rejected every legitimate password change) were only catchable this way — a unit test with mocked dependencies would have sailed straight past both.

## Project structure

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── auth/            # login, refresh, logout, password lifecycle, guards, strategy
│   ├── users/            # admin-controlled user CRUD
│   ├── prisma/           # global PrismaService
│   ├── types/             # Express.User type augmentation
│   └── app.module.ts
└── test/
    ├── auth.e2e-spec.ts
    ├── users.e2e-spec.ts
    ├── throttling.e2e-spec.ts
    └── utils/db-cleanup.ts
```

## API overview

### Auth

| Method | Route | Auth required | Notes |
|---|---|---|---|
| POST | `/auth/login` | No | Rate-limited (5/min) |
| POST | `/auth/refresh` | No (refresh token in body) | Rotates on use |
| POST | `/auth/logout` | Yes | Clears refresh session |
| GET | `/auth/me` | Yes | Returns authenticated identity |
| POST | `/auth/change-password` | Yes | Requires current password |
| POST | `/auth/forgot-password` | No | Rate-limited (5/min); no enumeration |
| POST | `/auth/reset-password` | No (reset token in body) | Invalidates refresh session |

### Users (ADMIN only)

| Method | Route | Notes |
|---|---|---|
| POST | `/users` | Cannot assign `ADMIN` role |
| GET | `/users` | |
| GET | `/users/:id` | |
| PATCH | `/users/:id` | Cannot promote to `ADMIN` |
| DELETE | `/users/:id` | Soft delete |

There is intentionally **no public registration endpoint** — every account in V1 is created by an Admin.

## Security

```
JWT                  ✅
Refresh tokens        ✅
Rotation               ✅
RBAC                    ✅
Logout                   ✅
Password change           ✅
Password reset              ✅
Rate limiting                  ✅
Security hardening                ✅
Email verification    — out of scope for V1 (decision, not a gap)
Audit logs             ⏳ deferred to a domain with real actions to audit
```

## Roadmap

```
0  Discovery                         ✅
1  Backend foundation                 ✅
2  Auth / Authorization / Users        ✅  ← you are here
3  Merchant + Driver                     ⏳ next
4  Parcel core
5  Assignment + Delivery
6  COD
7  Angular frontend
8  QR + Proof of Delivery
9  Real-time tracking
10 Notifications
11 Analytics + performance
12 Event-driven architecture
13 Enterprise architecture (DDD, potential microservices)
14 Production deployment
15 Route optimization
```

## Engineering principles

1. **Business before technology.** Every feature answers: what business problem, what business rule, what API, what data, what code, how do we prove it works — in that order, not "cool tech, find a reason to use it."
2. **Modular monolith first.** One deployable system with strong module boundaries, before any distributed complexity.
3. **The API is a contract**, shared by the (future) Angular frontend, the backend, and any future mobile clients — designed intentionally, not discovered by whatever the frontend happens to need.
4. **Complexity must earn its place.** Redis, Kafka, microservices, CQRS, ABAC — none of these are trophies. They get introduced when a real, current problem requires them, not because they're on a roadmap.
5. **Users ≠ domain entities.** A `User` is an authentication identity. A `Driver` (Stage 3) will be an operational identity. These are kept conceptually and eventually structurally separate.
6. **Database integrity matters.** Unique constraints, foreign keys, and transactional operations are used where they're the right authority — not everything needs to be re-implemented in application code.