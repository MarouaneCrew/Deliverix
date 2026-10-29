# DELIVERIX — EXECUTION BLUEPRINT FOR THE CODING AGENT

> Audience: a coding agent that executes exactly what is written, with no initiative.
> Author's intent: remove every decision from the agent. If a decision is missing, **STOP and ask** (see "STOP protocol").
> Scope of this document: **M0 and M1 are executable now.** M2–M7 are *specifications only* — do NOT start them until the human says "start M2" (etc.).

---

## 0. HOW TO USE THIS DOCUMENT

1. Read sections 1–3 fully before touching anything.
2. Execute tasks in the exact order written (T0.1, T0.2, …). Never reorder, merge, or skip.
3. Every task has: **Files**, **Steps**, **Expected**, **Gate** (commands that must pass), **Commit**.
4. If an **Expected** line does not match reality → follow the STOP protocol. Do not "fix it your own way".
5. After each task's Gate passes, make exactly one commit with exactly the given message.
6. At the end of a milestone, print the "MILESTONE REPORT" (section 3) and wait.

---

## 1. GLOBAL RULES (apply to every task, no exceptions)

| # | Rule |
|---|---|
| R1 | Work only inside the repository root (`Deliverix/`). All API commands run from `apps/api/` unless stated. |
| R2 | **Never** run: `prisma migrate reset`, `prisma db push`, `git reset --hard`, `git push`, `git push --force`, `git clean`, `rm -rf` (except deleting `dist/`), or any `DROP`/`TRUNCATE` by hand against a database whose name does not end in `_test`. |
| R3 | **Do not push, merge, or rebase.** Commit on the milestone branch only. The human merges. |
| R4 | **Do not install any npm package** unless a task explicitly lists the exact install command. |
| R5 | **Do not edit** anything under `apps/api/src/generated/` (it is produced by `npx prisma generate`). |
| R6 | **Do not refactor, rename, reformat, or "improve"** any file or code that a task does not list. No drive-by fixes. If you notice a problem, write it in the MILESTONE REPORT under "Observations" and leave it alone. |
| R7 | **Do not weaken, delete, skip (`it.skip`), or loosen any existing test or assertion** except the ones listed in the task's "Allowed test changes" table. |
| R8 | Prisma 7 specifics: import the client and types from `../generated/prisma/client` and enums from `../generated/prisma/enums` (adjust the relative path). After **any** change to `schema.prisma`, run `npx prisma generate`. |
| R9 | Code style: single quotes, trailing commas (see `.prettierrc`), 2-space indent in new files (existing files keep their own style), file names `kebab-case`, classes `PascalCase`, DTO classes end in `Dto`, one module per folder under `src/`. |
| R10 | **Never return secrets.** No response may contain `passwordHash`, `refreshTokenHash`, `refreshTokenExpiresAt`, `resetTokenHash`, `resetTokenExpiresAt`. Every Prisma read that feeds a response uses an explicit `select`. |
| R11 | **Tenancy rule:** every service method that touches a tenant-owned table takes `companyId: string` as its **first parameter** and includes `companyId` in the `where` of every query/update/delete on that table. `companyId` comes from `request.user.companyId` (via `@CurrentUser()`), **never** from the request body, query, or URL. |
| R12 | **Authorization rule:** every route handler has `@UseGuards(JwtAuthGuard, RolesGuard)` **and** its own `@Roles(...)` decorator. `RolesGuard` reads **handler-level** metadata only — a class-level `@Roles()` is silently ignored, so **never use class-level `@Roles()`**. A handler without `@Roles` is open to every authenticated user: that is only allowed where this document says "any authenticated user". |
| R13 | Cross-tenant access (an id that exists but belongs to another company) must behave exactly like "does not exist": respond **404**, never 403. |
| R14 | HTTP error mapping: validation → 400; no/invalid token → 401; wrong role → 403; not found (incl. cross-tenant) → 404; uniqueness/state conflict → 409. Use Nest exceptions (`BadRequestException`, `NotFoundException`, `ConflictException`, …). |
| R15 | Gate commands for "full verification" (called **FULL GATE** below), from `apps/api/`: `npm run build` then `npm run test:e2e:all`. Both must exit 0. |
| R16 | Timestamps are `DateTime` UTC. Primary keys are `String @id @default(cuid())`. Money (from M2 on) is integer minor units (centimes) — **never `Float`, never `Decimal`**. |
| R17 | No cascading deletes anywhere. Every foreign key is declared `onDelete: Restrict`. |

---

## 2. VERIFIED FACTS ABOUT THE REPOSITORY (treat as ground truth; verify in T0.1)

- Layout: `apps/api/` is the only application. NestJS 11, TypeScript 5, Prisma 7 (`provider = "prisma-client"`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`), PostgreSQL 17 via `docker-compose.yml` (container `deliverix-postgres`), Jest 30 + Supertest for e2e.
- Modules today: `PrismaModule` (@Global), `AuthModule`, `UsersModule`, plus boilerplate `app.controller.ts`/`app.service.ts`.
- `AuthService` stores refresh/reset tokens as SHA-256 hashes on the `User` row. Access JWT payload is `{ sub, role }`, expiry 15 min.
- `JwtStrategy.validate(payload)` currently returns `{ userId, role }` **without touching the database** (this is a known gap fixed in T1.2).
- `RolesGuard` reads roles via `reflector.get(ROLES_KEY, context.getHandler())` (handler-level only).
- Global `ValidationPipe({ whitelist: true, transform: true })` — unknown body fields are **silently stripped** (not rejected).
- Global `ThrottlerGuard` (default 20 req/min/IP; `LOGIN_THROTTLE_LIMIT`, `FORGOT_PASSWORD_THROTTLE_LIMIT`, `THROTTLE_GLOBAL_LIMIT` env vars override). Tests inflate these via `.env.test`; `test/jest-e2e-throttle-setup.ts` resets them to production values for the throttling suite.
- e2e scripts (package.json): `test:e2e` = `dotenv -e .env.test -- jest --config ./test/jest-e2e.json --runInBand`; `test:e2e:throttle`; `test:e2e:all`; `test:e2e:migrate` = `dotenv -e .env.test -- prisma migrate deploy`.
- Existing e2e files: `test/auth.e2e-spec.ts`, `test/users.e2e-spec.ts`, `test/throttling.e2e-spec.ts`, `test/app.e2e-spec.ts`, helper `test/utils/db-cleanup.ts`.
- Git: branch `main`; working tree has ONE uncommitted change: `apps/api/prisma/schema.prisma` (contains only `User` + `UserRole`). `HEAD` contains an **unmigrated draft** schema with extra models (Merchant, Driver, Parcel, …). **The working-tree version is the correct one.**
- No CI, no Dockerfile for the API, no git hooks exist.

---

## 3. PROTOCOLS

### 3.1 STOP protocol
Stop immediately and output the following block (fill it in), then wait for the human. Do not continue, do not guess.

```
STOP REPORT
Task: <id>
Step: <number>
Expected: <copy the Expected line>
Actual: <exact command output / error, trimmed to the relevant lines>
What I did NOT do: <anything skipped>
Question: <the single decision you need>
```

### 3.2 MILESTONE REPORT (print at the end of each milestone)
```
MILESTONE REPORT <M0|M1>
Commits: <git log --oneline for the branch>
FULL GATE: <pass/fail + test counts>
Files created: <list>
Files modified: <list>
Deviations from the blueprint: <none | list>
Observations (problems noticed but NOT touched): <list>
```

### 3.3 Commit protocol
- Branch names: `milestone/m0-foundation`, `milestone/m1-network-identity`.
- One commit per task. Message format exactly as given in each task. No co-author lines, no emojis.

---

## 4. GLOSSARY (so you interpret words correctly)

| Term | Meaning |
|---|---|
| Company | The delivery company that operates the system. V1 has exactly one, but every tenant-owned row carries `companyId`. |
| City | Shared reference data (e.g. Casablanca). **Not** tenant-owned (no `companyId`). |
| Hub | A company warehouse located in one city. |
| Dispatcher | Staff user bound to exactly one hub (`User.hubId`). |
| Driver | Operational profile attached 1:1 to a `User` with role `DRIVER`. Contractor in V1. Has a `homeHub`. |
| Merchant | A business that ships parcels. It always exists as a record; its login (`userId`) is optional. |
| Tenant-owned table | Any table with a `companyId` column. |

---

# MILESTONE M0 — FOUNDATION RESET

**Goal:** clean, reproducible base: committed correct schema, one-command test DB, FK-safe test cleanup, CI, request logging, health endpoint, ADR folder.
**Branch:** `milestone/m0-foundation`.

---

## T0.1 — Branch, verify state, commit the correct schema

**Files:** `apps/api/prisma/schema.prisma` (already modified in the working tree — do not edit it).

**Steps**
1. From repo root: `git status`
2. `git switch -c milestone/m0-foundation` (this carries the uncommitted change with you).
3. `cat apps/api/prisma/schema.prisma`
4. `ls apps/api/prisma/migrations`
5. `docker compose up -d` (repo root), wait 5 seconds.
6. `cd apps/api && npx prisma migrate status`

**Expected**
- Step 1: on branch `main`; the only modified file is `apps/api/prisma/schema.prisma`; nothing else modified or untracked except possibly ignored files.
- Step 3: the file contains **only** `generator client`, `datasource db`, `model User`, `enum UserRole { ADMIN DISPATCHER DRIVER }`. No other model or enum.
- Step 4: folders for the User table and refresh/reset token columns, plus `migration_lock.toml`. **No** migration mentions Merchant, Driver, Parcel, ParcelLeg, DeliveryGroup, Assignment or DeliveryAttempt.
- Step 6: reports the database schema is up to date, no pending migrations.

If any Expected line fails → STOP.

**Commit** (only `schema.prisma`):
`git add apps/api/prisma/schema.prisma && git commit -m "chore(db): restore schema to the migrated Stage 2 state (remove unmigrated draft models)"`

---

## T0.2 — Test environment: example file + one-command test database

**Files**
- CREATE `apps/api/.env.test.example`
- CREATE `apps/api/scripts/setup-test-db.sh`
- MODIFY `apps/api/package.json` (add one script)
- MODIFY `apps/api/.env.example` (append lines)
- MODIFY root `.gitignore` (only if needed)

**Steps**
1. Run `git check-ignore -v apps/api/.env.test`. If it prints nothing, append the line `.env.test` to the root `.gitignore`.
2. Create `apps/api/.env.test.example` with exactly:
```
NODE_ENV=test
DATABASE_URL="postgresql://deliverix:deliverix_dev@localhost:5432/deliverix_test"
JWT_SECRET="test-only-secret-not-for-production"
PORT=3001
LOGIN_THROTTLE_LIMIT=1000
FORGOT_PASSWORD_THROTTLE_LIMIT=1000
THROTTLE_GLOBAL_LIMIT=100000
```
3. Create `apps/api/scripts/setup-test-db.sh` with exactly:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Creates the deliverix_test database inside the docker postgres container if it does not exist.
CONTAINER="${POSTGRES_CONTAINER:-deliverix-postgres}"
PG_USER="${POSTGRES_USER:-deliverix}"
exists=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='deliverix_test'")
if [ "$exists" != "1" ]; then
  docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE deliverix_test"
  echo "Created deliverix_test"
else
  echo "deliverix_test already exists"
fi
```
   Then `chmod +x apps/api/scripts/setup-test-db.sh`.
4. In `apps/api/package.json` `scripts`, add exactly one entry after `test:e2e:migrate`: `"test:e2e:setup": "bash scripts/setup-test-db.sh"` (mind the comma on the previous line).
5. Append to `apps/api/.env.example` (keep existing 3 lines unchanged):
```
# Optional overrides (defaults: login 5/min, forgot-password 5/min, global 20/min)
# LOGIN_THROTTLE_LIMIT=5
# FORGOT_PASSWORD_THROTTLE_LIMIT=5
# THROTTLE_GLOBAL_LIMIT=20
```
6. If `apps/api/.env.test` does **not** exist: `cp apps/api/.env.test.example apps/api/.env.test`. If it exists, **do not overwrite it**.
7. From `apps/api/`: `npm run test:e2e:setup` then `npm run test:e2e:migrate`.

**Expected:** step 7 prints "Created deliverix_test" (or "already exists") and migrate deploy applies/says no pending migrations without error.
**Gate:** `git status` shows `.env.test` is NOT listed (it is ignored).
**Commit:** `chore(test): add .env.test.example and one-command test database setup`

---

## T0.3 — Baseline: all existing tests pass before any change

**Steps:** from `apps/api/`: `npm run build` then `npm run test:e2e:all`.
**Expected:** build exits 0; every test passes (README states 52 main + 3 throttling = 55; record the real number; a different but fully-passing count is acceptable and must be reported).
If anything fails → STOP (do not fix).
**Commit:** none (no changes).

---

## T0.4 — FK-safe, future-proof, guarded test cleanup

**Files:** REPLACE the whole content of `apps/api/test/utils/db-cleanup.ts` with exactly:

```ts
import { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Empties every table in the TEST database. Refuses to run against any
 * database whose name does not end with "_test".
 * Future-proof: it discovers tables from the catalog, so new models need no edits here.
 */
export async function cleanDatabase(prisma: PrismaClient) {
    const rows = await prisma.$queryRaw<{ current_database: string; }[]>`SELECT current_database()`;
    const dbName = rows[0].current_database;

    if (!dbName.endsWith('_test')) {
        throw new Error(`Refusing to clean database "${dbName}": its name must end with "_test"`);
    }

    const tables = await prisma.$queryRaw<{ tablename: string; }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

    if (tables.length === 0) return;

    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
```

**Gate:** FULL GATE passes with the same number of tests as T0.3.
**Commit:** `test: make cleanDatabase FK-safe, generic, and guarded to *_test databases`

---

## T0.5 — Request-ID + structured request logging

**Files**
- CREATE `apps/api/src/common/request-logging.interceptor.ts`
- MODIFY `apps/api/src/app.module.ts` (register interceptor)

**Behaviour of `RequestLoggingInterceptor`** (`@Injectable()`, implements `NestInterceptor`):
1. Read request header `x-request-id`. If present **and** it matches `/^[A-Za-z0-9_-]{1,64}$/`, use it; otherwise generate `randomUUID()` (import from `node:crypto`).
2. Set the response header `x-request-id` to that value (always, in every environment).
3. Record `Date.now()` at start. Register `res.once('finish', …)` which, **only when `process.env.NODE_ENV !== 'test'`**, writes exactly one line using Nest `Logger` (context string `'HTTP'`) via `logger.log(JSON.stringify({ requestId, method, path, statusCode, durationMs, userId }))`.
   - `path` = `req.originalUrl` with everything from the first `?` removed (**never log the query string, headers, or body** — they can contain tokens).
   - `userId` = `req.user?.userId ?? null`.
4. Return `next.handle()` unchanged.

**Registration:** in `AppModule.providers` add `{ provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor }` (import `APP_INTERCEPTOR` from `@nestjs/core`). Do not remove or reorder the existing providers.

**Gate:** FULL GATE passes (tests for this are added in T0.6).
**Commit:** `feat(observability): add request-id header and structured request logging`

---

## T0.6 — Health endpoint

**Files**
- CREATE `apps/api/src/health/health.controller.ts`
- CREATE `apps/api/src/health/health.module.ts`
- MODIFY `apps/api/src/app.module.ts` (add `HealthModule` to `imports`)
- CREATE `apps/api/test/health.e2e-spec.ts`

**Behaviour:** `GET /health` — public (no guards), decorated with `@SkipThrottle()` (from `@nestjs/throttler`) so monitors are never rate-limited. Runs `await this.prisma.$queryRaw\`SELECT 1\`` (inject `PrismaService`; it is global). Success → `200` body `{ "status": "ok" }`. If the query throws → throw `ServiceUnavailableException` (503) with message `'Database unavailable'`.

**Tests (`health.e2e-spec.ts`, same bootstrap pattern as `users.e2e-spec.ts`, no cleanDatabase needed):**
1. `GET /health` → 200, body `{ status: 'ok' }`.
2. Response has a non-empty `x-request-id` header.
3. Sending header `x-request-id: abc-123` → response header equals `abc-123`.
4. Sending header `x-request-id: bad value!!` (invalid characters) → response header is **not** `bad value!!` and matches `/^[0-9a-f-]{36}$/`.

**Gate:** FULL GATE passes (previous count + 4).
**Commit:** `feat(health): add public GET /health with database check`

---

## T0.7 — CI workflow

**Files:** CREATE `.github/workflows/ci.yml` (repo root) with exactly:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/api
    env:
      DATABASE_URL: postgresql://deliverix:deliverix_ci@localhost:5432/deliverix_test
      JWT_SECRET: ci-only-secret
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: deliverix
          POSTGRES_PASSWORD: deliverix_ci
          POSTGRES_DB: deliverix_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U deliverix -d deliverix_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: apps/api/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
      - name: Write .env.test
        run: |
          cat > .env.test <<'EOF'
          NODE_ENV=test
          DATABASE_URL=postgresql://deliverix:deliverix_ci@localhost:5432/deliverix_test
          JWT_SECRET=ci-only-secret
          PORT=3001
          LOGIN_THROTTLE_LIMIT=1000
          FORGOT_PASSWORD_THROTTLE_LIMIT=1000
          THROTTLE_GLOBAL_LIMIT=100000
          EOF
      - run: npm run test:e2e:migrate
      - run: npm run test:e2e:all
```

**Notes for you:** do NOT add a lint step (the lint baseline has not been measured). The heredoc lines inside `run: |` must keep the same indentation as `cat`, as written above (YAML strips the common indent).
**Gate:** the file is valid YAML: run `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` from repo root; exit 0. (You cannot run the workflow locally; the human will verify it on GitHub.)
**Commit:** `ci: add GitHub Actions workflow (build + e2e against Postgres 17)`

---

## T0.8 — Architecture Decision Records

**Files:** CREATE folder `docs/adr/` at repo root with the files below. Each ADR file uses this exact template, filled with the text given:

```
# ADR-XXXX: <Title>
Status: Accepted
Date: 2026-10-06

## Context
<text>

## Decision
<text>

## Consequences
<text>
```

| File | Title | Context | Decision | Consequences |
|---|---|---|---|---|
| `0001-tenant-ready-single-company.md` | Tenant-ready, single company in V1 | V1 serves one delivery company; a SaaS model for many companies is plausible later and retrofitting tenancy into populated tables is costly and risks cross-company data leaks. | A `Company` table exists with one row. Every tenant-owned table has a required `companyId`. Services take `companyId` as the first parameter and filter every query by it (it comes from the authenticated user, never from client input). `City` is shared reference data and has no `companyId`. User email stays globally unique. | Slightly more code per query; mandatory cross-company isolation tests per module. |
| `0002-assignment-seam.md` | Driver assignment goes through one seam | V1 drivers are contractors who obey the dispatcher; later, freelancers will accept or reject offers. | In V1 an assignment is created only through one service function `assignDriver`. Assignment statuses in V1: ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED. No accept/reject exists. A later version swaps the function's policy and adds OFFERED/ACCEPTED/REJECTED/EXPIRED. `Driver.engagement` is CONTRACTOR in V1. | No `mode` column now (it can be added later with default DIRECT). |
| `0003-money-as-integer-minor-units.md` | Money is integer centimes | Floats cannot represent decimal money exactly and break cash reconciliation. 1 MAD = 100 centimes. | All money columns are `Int` in centimes, named `...Minor`, with a `currency` code (default `MAD`) where a currency applies. | Display layer divides by 100. |
| `0004-state-machines.md` | Lifecycles are state machines in domain code | A database enum allows any value in any order. | Parcel, Leg, Run, Assignment and cash-collection statuses change only through one domain function per aggregate that checks an allowed-transition table, then writes the status and an event in one transaction. Direct `update({ status })` is forbidden outside that function. | A transition table + tests per aggregate. |
| `0005-legs-and-planner.md` | Routes are legs produced by a planner module | Parcels travel pickup → linehaul → delivery, sometimes fewer legs, and return trips reverse them. | A leg is `(type PICKUP/LINEHAUL/DELIVERY, direction FORWARD/RETURN, from, to, sequence)`. A `routing` module computes legs. Re-planning marks old unfinished legs SUPERSEDED (kept forever) and creates new ones; history is never edited. | The planner is real code with table-driven tests. |
| `0006-event-log.md` | Append-only parcel event log | Tracking, audit and analytics all need "what happened and when". | Every parcel state/custody change inserts a `ParcelEvent` row in the same transaction. Rows are never updated or deleted by application code. | All write paths must go through domain services. |
| `0007-custody-denormalized.md` | Current custody stored on the parcel | Dispatchers need "which parcels are at my hub" fast. | `Parcel.custodianType/custodianId` hold the current custodian; the event log holds history. Both change in one transaction. | Two places to keep consistent; one transaction guarantees it. |
| `0008-scoped-authorization.md` | RBAC plus scoped policies, no ABAC engine | Roles alone cannot express "dispatcher of this hub" or "merchant's own parcels". | Roles via `@Roles` (handler-level). Scope checks are explicit code in services: dispatcher by `hubId`, merchant by own merchant id, driver by own assignments. Cross-tenant/cross-scope ids return 404. | Every query must apply its scope; covered by tests. |
| `0009-no-zone-entity-v1.md` | No Zone entity in V1 | A hub belongs to one city and each dispatcher to one hub. | No `Zone` table; routing assumes exactly one active hub per city. | If a city later needs several zones/hubs this is an additive change. |
| `0010-business-decisions-v1.md` | V1 business decisions | Decisions recorded from discovery. | Drivers are contractors under dispatcher command. Merchants may have a login or not; a dispatcher can create a merchant record and attach a login later. Returns are reverse legs through the hubs. The receiver pays the shipping fee at delivery (collected together with COD). The dispatcher confirms COD cash handover. A merchant may submit parcels in a batch with different destinations. Multi-leg delivery is required in V1. | Pricing is a per-company city-pair tariff. |

Also CREATE `docs/adr/README.md` containing: a title line `# Architecture Decision Records`, one sentence "One file per decision; never edit an accepted ADR, supersede it with a new one.", and a bullet list linking all ten files.

**Gate:** `ls docs/adr` shows 11 files.
**Commit:** `docs: add ADR-0001..0010 and index`

---

## T0.9 — M0 final verification

**Steps:** from `apps/api/`: `npm run build`; `npm run test:e2e:all`; then from root `git status` (must be clean) and `git log --oneline main..HEAD`.
**Expected:** FULL GATE passes; working tree clean; exactly 7 commits on the branch (T0.1, T0.2, T0.4, T0.5, T0.6, T0.7, T0.8; T0.3 and T0.9 make none). If the count differs, report it.
**Action:** print the MILESTONE REPORT for M0 and **wait**.

---

# MILESTONE M1 — NETWORK AND IDENTITY

**Goal:** the company, its cities/hubs, merchants (optional login) and drivers exist as scoped data, with immediate token revocation.
**Branch:** create from the merged M0 state when the human says "start M1": `git switch -c milestone/m1-network-identity`.
**Out of scope for M1 (do NOT build):** parcels, legs, runs, assignments, pagination, Swagger/OpenAPI, frontend, deleting cities/hubs, any audit log, hub-deactivation side-effects.

## M1 AUTHORIZATION MATRIX (single source of truth)

| Route | ADMIN | DISPATCHER | DRIVER | MERCHANT |
|---|---|---|---|---|
| `POST /cities`, `PATCH /cities/:id` | ✔ | ✘ | ✘ | ✘ |
| `GET /cities`, `GET /cities/:id` | ✔ | ✔ | ✔ | ✔ |
| `POST /hubs`, `PATCH /hubs/:id` | ✔ | ✘ | ✘ | ✘ |
| `GET /hubs`, `GET /hubs/:id` | ✔ | ✔ | ✔ | ✔ |
| `POST /merchants`, `PATCH /merchants/:id`, `POST /merchants/:id/account` | ✔ | ✔ | ✘ | ✘ |
| `GET /merchants`, `GET /merchants/:id` | ✔ | ✔ | ✘ | own only |
| `GET /merchants/me` | ✘ | ✘ | ✘ | ✔ |
| `DELETE /merchants/:id` | ✔ | ✘ | ✘ | ✘ |
| `POST /drivers`, `PATCH /drivers/:id` | ✔ | own hub only | ✘ | ✘ |
| `GET /drivers`, `GET /drivers/:id` | ✔ (all) | own hub only | ✘ | ✘ |
| `DELETE /drivers/:id` | ✔ | ✘ | ✘ | ✘ |
| `POST/GET/GET:id/PATCH/DELETE /users` | ✔ | ✘ | ✘ | ✘ |

"Any authenticated user" for the GET city/hub routes is implemented as `@Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.MERCHANT)` (explicit list, still satisfying R12).

---

## T1.0 — Branch and precheck

**Steps:** `git status` (clean) → `git switch -c milestone/m1-network-identity` → from `apps/api/`: `npm run test:e2e:all`.
**Expected:** clean tree; FULL GATE passes. Else STOP.
**Commit:** none.

---

## T1.1 — Schema, migration, seed

**Files:** `apps/api/prisma/schema.prisma` (REPLACE), new migration folder (generated), `apps/api/prisma/seed.ts` (REPLACE).

**IMPORTANT:** after this task, `npm run build` and the tests are **expected to fail** until T1.2 is done (TypeScript will complain that `companyId` is required). That is normal. T1.1's gate is only the Prisma commands below. Do not "fix" the compile errors in this task.

### 1. Replace `schema.prisma` with exactly this

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  ADMIN
  DISPATCHER
  DRIVER
  MERCHANT
}

enum DriverEngagement {
  CONTRACTOR
}

enum DriverStatus {
  AVAILABLE
  ON_DELIVERY
  OFFLINE
}

model Company {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  hubs      Hub[]
  merchants Merchant[]
  drivers   Driver[]
}

// Shared reference data. Deliberately NOT tenant-owned (no companyId).
model City {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  hubs      Hub[]
  merchants Merchant[]
}

model Hub {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  cityId    String
  city      City     @relation(fields: [cityId], references: [id], onDelete: Restrict)
  name      String
  address   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  dispatchers User[]
  drivers     Driver[]

  @@unique([companyId, name])
  @@index([companyId])
  @@index([cityId])
}

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  passwordHash          String
  role                  UserRole
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?
  refreshTokenHash      String?
  refreshTokenExpiresAt DateTime?
  resetTokenHash        String?
  resetTokenExpiresAt   DateTime?

  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Restrict)
  // Only meaningful for DISPATCHER users (their hub). Null for everyone else.
  hubId     String?
  hub       Hub?    @relation(fields: [hubId], references: [id], onDelete: Restrict)

  driver    Driver?
  merchant  Merchant?

  @@index([companyId])
  @@index([hubId])
}

model Merchant {
  id        String    @id @default(cuid())
  companyId String
  company   Company   @relation(fields: [companyId], references: [id], onDelete: Restrict)
  // Optional login. A merchant exists as a business record even without one.
  userId    String?   @unique
  user      User?     @relation(fields: [userId], references: [id], onDelete: Restrict)
  cityId    String
  city      City      @relation(fields: [cityId], references: [id], onDelete: Restrict)
  name      String
  phone     String?
  address   String?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([companyId])
  @@index([cityId])
}

model Driver {
  id         String           @id @default(cuid())
  companyId  String
  company    Company          @relation(fields: [companyId], references: [id], onDelete: Restrict)
  userId     String           @unique
  user       User             @relation(fields: [userId], references: [id], onDelete: Restrict)
  homeHubId  String
  homeHub    Hub              @relation(fields: [homeHubId], references: [id], onDelete: Restrict)
  fullName   String
  phone      String
  engagement DriverEngagement @default(CONTRACTOR)
  status     DriverStatus     @default(AVAILABLE)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@index([companyId])
  @@index([homeHubId])
}
```

### 2. Create the migration (existing dev data must survive)
1. From `apps/api/`: `npx prisma validate` → must say valid.
2. `npx prisma migrate dev --create-only --name foundation_network_identity`
3. Open the new `migration.sql`. Make **exactly** these edits (the existing `User` rows, e.g. the dev admin, must be given a company before `companyId` becomes NOT NULL):
   a. In the statement that adds columns to `"User"`, change `"companyId" TEXT NOT NULL` to `"companyId" TEXT` (nullable for now). Leave `"hubId" TEXT` as is.
   b. Immediately **after** the `CREATE TABLE "Company"` statement, insert:
```sql
INSERT INTO "Company" ("id", "name", "updatedAt")
SELECT 'seed-company', 'Deliverix Demo', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User");
```
   c. Immediately **after** the `ALTER TABLE "User" ADD COLUMN ...` statement, insert:
```sql
UPDATE "User" SET "companyId" = 'seed-company' WHERE "companyId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
```
   d. Confirm the foreign-key constraints for `User.companyId` are added **after** these statements (Prisma emits FKs at the end; do not move them). If the file does not contain an `ALTER TABLE "User" ADD COLUMN` statement shaped as described → STOP.
4. Apply: `npx prisma migrate dev` (applies the edited migration to the dev DB). Then `npx prisma generate`. Then `npm run test:e2e:migrate` (applies to the test DB).

### 3. Replace `prisma/seed.ts`
Keep the existing imports/adapter/client setup and the `main().catch().finally()` structure. Inside `main()` do, in this order, all with `upsert` (idempotent):
1. Company: `where: { id: 'seed-company' }`, create/update `{ name: 'Deliverix Demo' }` (create must set `id: 'seed-company'`).
2. Cities (upsert by unique `name`): `Casablanca`, `Rabat`, `Marrakech`, `Agadir`, `Tangier`.
3. One hub per city (upsert by `companyId_name` compound unique): name `"<City> Hub"` (e.g. `Casablanca Hub`), `companyId: 'seed-company'`, `cityId` of that city.
4. Admin user (upsert by `email: 'admin@deliverix.local'`): same fields as today (`passwordHash` of `'123'`, `role: 'ADMIN'`, `isActive: true`, `deletedAt: null`) plus `companyId: 'seed-company'`, `hubId: null`.
5. `console.log('Development seed ready')`.

**Gate (T1.1):** `npx prisma validate` OK; `npx prisma migrate status` reports up to date for dev; `npm run test:e2e:migrate` succeeds; `npx prisma generate` succeeds; the seed runs and prints `Development seed ready`. The README says `npm run seed`, but `package.json` as audited has no `seed` script and no `prisma.seed` config. If `npm run seed` does not exist, **STOP** and report (do not install anything, do not invent a runner).
**Commit:** `feat(db): add Company, City, Hub, Merchant, Driver; scope User to company/hub; seed network`

---

## T1.2 — Tenancy plumbing, immediate token revocation, users module, test fixtures

After this task the build and **all** tests must be green again.

### A. Type augmentation
MODIFY `apps/api/src/types/express.d.ts`: the `Express.User` interface becomes exactly:
```ts
interface User {
    userId: string;
    role: UserRole;
    companyId: string;
    hubId: string | null;
}
```

### B. `JwtStrategy` checks the database on every request (closes the "revoked token valid for 15 min" gap)
MODIFY `apps/api/src/auth/strategies/jwt.strategy.ts`:
- Constructor now receives `config: ConfigService` **and** `private readonly prisma: PrismaService` (import from `../../prisma/prisma.service`).
- `validate(payload: { sub: string; role: UserRole })` becomes:
  1. `const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, companyId: true, hubId: true, isActive: true, deletedAt: true } })`
  2. If `!user || !user.isActive || user.deletedAt` → `throw new UnauthorizedException()`.
  3. Return `{ userId: user.id, role: user.role, companyId: user.companyId, hubId: user.hubId }` (the **role comes from the database**, not from the token).
- Do not change the JWT payload that `AuthService` signs.

### C. Users module changes
1. MODIFY `src/users/constants/user-roles.ts` to exactly:
```ts
import { UserRole } from "../../generated/prisma/enums";

// /users only creates staff that need no profile. Drivers and merchants are created via /drivers and /merchants.
export const assignableRoles = [UserRole.DISPATCHER];

export type AssignableUserRole = typeof UserRole.DISPATCHER;
```
   (If `typeof UserRole.DISPATCHER` does not type-check with the generated enum, use the string literal type `'DISPATCHER'`. Do not change anything else.)
2. MODIFY `create-user.dto.ts`: keep `email`, `password`, `role` exactly as is; add `@IsString() @IsNotEmpty() hubId: string;` (add the imports).
3. MODIFY `update-user.dto.ts`: **remove** the `role` field and its imports; add `@IsOptional() @IsString() @IsNotEmpty() hubId?: string;`. Keep `email`, `password`, `isActive`.
4. MODIFY `users.controller.ts`: add `@CurrentUser() actor: Express.User` as the first parameter of every handler (import `CurrentUser` from `../auth/decorators/current-user.decorator`) and pass `actor.companyId` as the first argument to the corresponding service method. Keep guards and `@Roles(UserRole.ADMIN)` unchanged.
5. MODIFY `users.service.ts` — every method takes `companyId` first:
   - `create(companyId, dto)`: email uniqueness check as today (global). Verify the hub: `prisma.hub.findFirst({ where: { id: dto.hubId, companyId } })`; missing → `NotFoundException('Hub not found')`. Create the user with `companyId`, `role: dto.role`, `hubId: dto.hubId`. Return `{ id, email, role, isActive, hubId }`.
   - `findAll(companyId)`: `where: { companyId }`; select adds `hubId: true`.
   - `findOne(companyId, id)`: `where: { id, companyId }` via `findFirst`; select adds `hubId: true`; missing → 404.
   - `update(companyId, id, dto)`: build `data` from `email`, `isActive`, hashed `password` (if given). If `dto.hubId` is provided: first load the target `findFirst({ where: { id, companyId }, select: { role: true } })` (missing → 404); if target role is not `DISPATCHER` → `BadRequestException('hubId only applies to dispatchers')`; verify the hub belongs to `companyId` (else `NotFoundException('Hub not found')`); set `data.hub = { connect: { id: dto.hubId } }`. Then `prisma.user.update({ where: { id, companyId }, data, select: { …, hubId: true } })`. Keep the existing P2025→404 and P2002→409 mapping.
   - `remove(companyId, id)`: same soft-delete as today with `where: { id, companyId }`; P2025 → 404.

### D. Test fixtures (new helper)
CREATE `apps/api/test/utils/fixtures.ts` exporting exactly these functions (typed with `PrismaClient` from `../../src/generated/prisma/client` and `INestApplication`):
- `createCompany(prisma, name = 'Test Co')` → creates and returns a `Company`.
- `createCity(prisma, name = 'Testville')` → creates and returns a `City`.
- `createHub(prisma, { companyId, cityId, name = 'Test Hub' })` → returns a `Hub`.
- `createTenant(prisma)` → creates company + city + hub, returns `{ company, city, hub }`.
- `createUserFixture(prisma, { companyId, role, hubId = null, email?, password = 'password123' })` → bcrypt-hashes the password (cost 4 is fine in tests: `bcryptjs.hash(password, 4)`), creates the user, returns `{ user, email, password }`. Default email: `e2e-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@deliverix.test`.
- `loginAs(app, email, password)` → `POST /auth/login`, expects 201, returns `{ accessToken, refreshToken }`.

### E. Update the existing specs (mechanical)
In `auth.e2e-spec.ts`, `users.e2e-spec.ts`, `throttling.e2e-spec.ts`:
- After each `cleanDatabase(prisma)` create a company via `createTenant` (keep it in a `let tenant` variable) and add `companyId: tenant.company.id` wherever `prisma.user.create({ data: {...} })` is called directly. In `users.e2e-spec.ts` `createAndLogin(role)` becomes: create via `createUserFixture` with `companyId: tenant.company.id`, then `loginAs`.
- In `throttling.e2e-spec.ts` the test at "allows a single legitimate attempt" also needs a company.
- Change **only** the assertions in this table; everything else stays byte-identical in intent:

| Spec | Test title | Allowed change |
|---|---|---|
| users | 'ADMIN creates a DISPATCHER user…' | request body adds `hubId: tenant.hub.id`; additionally expect `res.body.hubId` toBe that id. |
| users | 'ADMIN creates a DRIVER user' | rename to `'rejects creating a DRIVER via /users (drivers are created via /drivers)'`; send `role: 'DRIVER'`; expect **400**. |
| users | 'rejects when caller is not ADMIN (403)' | request body adds `hubId`. role stays `DRIVER` in body → still ends 403 because the guard runs before validation; keep expecting 403. |
| users | 'rejects a duplicate email with 409' | both requests use `role: 'DISPATCHER'` plus `hubId`. |
| users | 'rejects a password shorter than 8 characters' | use `role: 'DISPATCHER'` plus `hubId`; still 400. |
| users | 'rejects creating a user with role ADMIN…' | add `hubId`; still 400. |
| users | 'rejects trying to promote a user to ADMIN via the DTO' | rename to `'ignores a role field on update (role is immutable)'`; expect **200** and assert in the DB that the target's role is still `DISPATCHER`. |

### F. New tests (add to existing specs)
In `auth.e2e-spec.ts` add a `describe('Access token revocation')`:
1. After login, `GET /auth/me` with the access token → 200 and body equals `{ userId, role, companyId, hubId }` (`hubId` null for an ADMIN fixture).
2. Admin deactivates that user via `PATCH /users/:id { isActive: false }` (use a second ADMIN fixture) → the **same still-unexpired access token** now gets **401** on `/auth/me`.
3. Same for soft-deleting via `DELETE /users/:id` → 401.

In `users.e2e-spec.ts` add:
4. `POST /users` with a `hubId` of a hub in **another company** → 404.
5. `PATCH /users/:id { hubId }` on a target whose role is not DISPATCHER (create a DRIVER user directly with `createUserFixture`) → 400.
6. `GET /users/:id` for a user of another company → 404 (create a second tenant + user for this).
7. `GET /users` returns only users of the caller's company.

**Gate:** `npx prisma generate` then FULL GATE passes.
**Commit:** `feat(auth): per-request user check, company scoping, dispatcher hub; users module scoped`

---

## T1.3 — Network module (cities and hubs)

**Files (CREATE):** `src/network/network.module.ts`, `src/network/cities.controller.ts`, `src/network/cities.service.ts`, `src/network/hubs.controller.ts`, `src/network/hubs.service.ts`, `src/network/dto/create-city.dto.ts`, `update-city.dto.ts`, `create-hub.dto.ts`, `update-hub.dto.ts`, `test/network.e2e-spec.ts`. MODIFY `app.module.ts` (import `NetworkModule`).

**DTOs**
- `CreateCityDto { name }`: `@IsString @IsNotEmpty @MaxLength(80)`; trim with `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)` (import from `class-transformer`).
- `UpdateCityDto { name? }` same rules, `@IsOptional`.
- `CreateHubDto { cityId, name, address? }`: `cityId` `@IsString @IsNotEmpty`; `name` as above (max 120, trimmed); `address` `@IsOptional @IsString @MaxLength(255)`.
- `UpdateHubDto { name?, address?, isActive? }`: all `@IsOptional`; `isActive` `@IsBoolean`.

**Cities (global, no companyId; follow the matrix):**
- `POST /cities` → 201 `{ id, name }`. Duplicate name (case-insensitive: `findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })`) → 409 `'City already exists'`.
- `GET /cities` → array of `{ id, name }` ordered by `name asc`.
- `GET /cities/:id` → `{ id, name }` or 404.
- `PATCH /cities/:id` → updated `{ id, name }`; 404 if missing; duplicate (another city, case-insensitive) → 409.

**Hubs (tenant-owned; R11 applies):**
- Response shape everywhere: `{ id, name, address, isActive, cityId, city: { id, name }, createdAt }`.
- `POST /hubs` → 201. City must exist (else 404 `'City not found'`). Duplicate `(companyId, name)` → 409 `'Hub already exists'` (catch Prisma `P2002`).
- `GET /hubs` → company's hubs ordered by `name asc`. `GET /hubs/:id` → 404 if not in company.
- `PATCH /hubs/:id` → update provided fields; 404 if not in company; duplicate name → 409.

**Tests (`network.e2e-spec.ts`)** — use fixtures; each row is one `it`:

| # | Case | Expect |
|---|---|---|
| 1 | ADMIN creates city | 201, body has id+name |
| 2 | duplicate city `casablanca` vs existing `Casablanca` | 409 |
| 3 | DISPATCHER `POST /cities` | 403 |
| 4 | no token `POST /cities` | 401 |
| 5 | DISPATCHER/DRIVER/MERCHANT `GET /cities` | 200 each |
| 6 | `GET /cities/:id` unknown id | 404 |
| 7 | PATCH city name | 200 new name |
| 8 | ADMIN creates hub | 201, includes `city.name` |
| 9 | hub with unknown `cityId` | 404 |
| 10 | duplicate hub name in same company | 409 |
| 11 | same hub name in a **different** company | 201 |
| 12 | DISPATCHER `POST /hubs` | 403 |
| 13 | `GET /hubs` returns only own company's hubs (two tenants) | exactly own |
| 14 | `GET /hubs/:id` of another company | 404 |
| 15 | PATCH hub `isActive: false` | 200, `isActive` false |
| 16 | PATCH hub of another company | 404 |
| 17 | blank/whitespace-only city name | 400 |

**Gate:** FULL GATE. **Commit:** `feat(network): cities (shared) and hubs (company-scoped) with admin management`

---

## T1.4 — Merchants module

**Files (CREATE):** `src/merchants/merchants.module.ts`, `merchants.controller.ts`, `merchants.service.ts`, `dto/create-merchant.dto.ts`, `update-merchant.dto.ts`, `create-merchant-account.dto.ts`, `test/merchants.e2e-spec.ts`. MODIFY `app.module.ts`.

**DTOs**
- `CreateMerchantDto { name, cityId, phone?, address? }`: `name` string, non-empty, max 120, trimmed; `cityId` string non-empty; `phone` optional, `@Matches(/^\+?[0-9]{8,15}$/)`; `address` optional string max 255.
- `UpdateMerchantDto`: same fields all optional, plus `isActive?: boolean`.
- `CreateMerchantAccountDto { email, password }`: `@IsEmail`, `@MinLength(8)`.

**Response shape (everywhere):** `{ id, name, phone, address, cityId, city: { id, name }, isActive, hasLogin: boolean, userId, createdAt }` where `hasLogin = userId !== null`.

**Endpoints (matrix applies; declare `GET merchants/me` BEFORE `GET merchants/:id` in the controller):**
- `POST /merchants` → 201. City must exist (404 `'City not found'`). Creates with `companyId`, `userId: null`.
- `GET /merchants` → company's merchants where `deletedAt IS NULL`, ordered by `name asc`.
- `GET /merchants/me` (MERCHANT) → the merchant where `{ companyId, userId: actor.userId, deletedAt: null }`; none → 404.
- `GET /merchants/:id` → `{ id, companyId, deletedAt: null }`; if actor role is MERCHANT additionally require `userId === actor.userId`; otherwise 404.
- `PATCH /merchants/:id` → partial update; city (if provided) must exist; 404 if not in company or soft-deleted.
- `DELETE /merchants/:id` (ADMIN) → soft delete: `isActive=false`, `deletedAt=now()`; if the merchant has a `userId`, also soft-delete that user in the **same** `$transaction` (`isActive=false`, `deletedAt=now()`). Return `{ id }`. 404 if missing.
- `POST /merchants/:id/account` → 201 `{ merchantId, userId, email }`. In one `prisma.$transaction`: load merchant `{ id, companyId, deletedAt: null }` (404 if none); if `userId` already set → 409 `'Merchant already has a login'`; email already used by any user → 409 `'Email already exists'`; create `User { role: MERCHANT, companyId, hubId: null, passwordHash: bcrypt(10) }`; set `merchant.userId`. Also map Prisma `P2002` to the 409 above.

**Tests (`merchants.e2e-spec.ts`)**

| # | Case | Expect |
|---|---|---|
| 1 | DISPATCHER creates merchant (no login) | 201, `hasLogin` false |
| 2 | ADMIN creates merchant | 201 |
| 3 | DRIVER / MERCHANT `POST /merchants` | 403 |
| 4 | unknown `cityId` | 404 |
| 5 | invalid phone `abc` | 400 |
| 6 | attach account to merchant | 201; then that merchant logs in via `/auth/login` (201) |
| 7 | attach account twice | 409 |
| 8 | attach account with an email already used | 409 |
| 9 | merchant user `GET /merchants/me` | 200, own record |
| 10 | merchant user `GET /merchants/:id` of **another** merchant | 404 |
| 11 | merchant user `GET /merchants` | 403 |
| 12 | merchant user `GET /users` | 403 |
| 13 | DISPATCHER `DELETE /merchants/:id` | 403 |
| 14 | ADMIN deletes merchant with login → merchant gone from list; the merchant's old access token → 401 on `/auth/me`; login → 401 |
| 15 | tenancy: `GET /merchants/:id`, `PATCH`, `POST :id/account` for another company's merchant | 404 each |
| 16 | `GET /merchants` shows only own company's | exact |
| 17 | `GET /merchants/me` by a non-MERCHANT role | 403 |

**Gate:** FULL GATE. **Commit:** `feat(merchants): merchant records with optional login and own-data access`

---

## T1.5 — Drivers module

**Files (CREATE):** `src/drivers/drivers.module.ts`, `drivers.controller.ts`, `drivers.service.ts`, `dto/create-driver.dto.ts`, `update-driver.dto.ts`, `test/drivers.e2e-spec.ts`. MODIFY `app.module.ts`.

**DTOs**
- `CreateDriverDto { email, password, fullName, phone, homeHubId }`: `@IsEmail`; `@MinLength(8)`; `fullName` string non-empty max 120 trimmed; `phone` `@Matches(/^\+?[0-9]{8,15}$/)`; `homeHubId` string non-empty.
- `UpdateDriverDto { fullName?, phone?, homeHubId?, status? }`: all optional; `status` `@IsEnum(DriverStatus)` (import the enum from `../generated/prisma/enums`).

**Response shape (everywhere):** `{ id, userId, email, isActive, fullName, phone, homeHubId, homeHub: { id, name }, engagement, status, createdAt }` (`email`/`isActive` come from the related user via `select`).

**Scope helper (in `drivers.service.ts`, private):** `resolveHubScope(actor)` → for ADMIN returns `null` (no restriction); for DISPATCHER returns `actor.hubId`, and if that is `null` throw `ForbiddenException('Dispatcher has no hub')`.

**Endpoints**
- `POST /drivers` → 201. Hub `{ id: homeHubId, companyId }` must exist (404 `'Hub not found'`). If scope is a dispatcher hub and `homeHubId !== scope` → 403 `'Not allowed for this hub'`. Email taken → 409. One `$transaction`: create `User { role: DRIVER, companyId, hubId: null }` then `Driver { companyId, userId, homeHubId, fullName, phone }`.
- `GET /drivers` → company drivers (user not soft-deleted: `user.deletedAt: null`). Dispatcher: add `homeHubId: scope`. Admin: optional query `?hubId=` filter (validate it is a non-empty string; ignore otherwise). Ordered by `fullName asc`.
- `GET /drivers/:id` → `{ id, companyId }` plus dispatcher scope `homeHubId`; missing/out of scope → 404.
- `PATCH /drivers/:id` → load with the same scoping (404 if none). If dispatcher and `dto.homeHubId` given and `!== scope` → 403. If `homeHubId` given verify the hub in company (404). Update only provided fields.
- `DELETE /drivers/:id` (ADMIN) → soft-delete the driver's **user** (`isActive=false`, `deletedAt=now()`) with `where` scoped by company; return `{ id }` (the driver id). The driver row stays.

**Tests (`drivers.e2e-spec.ts`)** — fixtures: tenant A with hubs `H1` and `H2`; DISPATCHER fixtures bound to H1 (and one to H2); a second tenant B.

| # | Case | Expect |
|---|---|---|
| 1 | ADMIN creates driver in H1 | 201; then the driver logs in; `GET /auth/me` role DRIVER |
| 2 | DISPATCHER(H1) creates driver in H1 | 201 |
| 3 | DISPATCHER(H1) creates driver in H2 | 403 |
| 4 | hub of another company | 404 |
| 5 | duplicate email | 409 |
| 6 | short password / bad phone / missing fullName | 400 each |
| 7 | DRIVER and MERCHANT `POST /drivers` | 403 |
| 8 | DISPATCHER(H1) `GET /drivers` shows only H1 drivers | exact |
| 9 | ADMIN `GET /drivers` shows all of own company; `?hubId=H2` filters | exact |
| 10 | DISPATCHER(H1) `GET /drivers/:id` of an H2 driver | 404 |
| 11 | DISPATCHER(H1) PATCH own driver `status: 'OFFLINE'` | 200 |
| 12 | DISPATCHER(H1) PATCH driver to `homeHubId: H2` | 403 |
| 13 | ADMIN PATCH driver to `homeHubId: H2` | 200 |
| 14 | invalid `status` value | 400 |
| 15 | DISPATCHER `DELETE /drivers/:id` | 403 |
| 16 | ADMIN deletes driver → listing no longer returns it; driver login → 401; old access token → 401 |
| 17 | tenancy: every endpoint with tenant B's driver id from tenant A's admin | 404 |
| 18 | admin user (null hub) acting as dispatcher scope not needed; DISPATCHER fixture with `hubId: null` calling `GET /drivers` | 403 |

**Gate:** FULL GATE. **Commit:** `feat(drivers): driver profiles with home hub and dispatcher hub scoping`

---

## T1.6 — Cross-tenant isolation sweep and documentation

### A. Isolation test file
CREATE `test/tenancy.e2e-spec.ts`. Build two tenants (A, B), each with an ADMIN. Seed in B: a hub, a merchant, a driver, a dispatcher. Then, authenticated as A's ADMIN, assert **404** for each of: `GET/PATCH /hubs/:bId`, `GET/PATCH/DELETE /merchants/:bId`, `POST /merchants/:bId/account`, `GET/PATCH/DELETE /drivers/:bId`, `GET/PATCH/DELETE /users/:bDispatcherId`. And assert list endpoints (`/hubs`, `/merchants`, `/drivers`, `/users`) never contain any of B's ids.

### B. Documentation
1. In root `README.md`, replace the phrase `drivers are **employees**, not freelance couriers who accept or reject jobs` with `drivers are **contractors working under dispatcher command**, not freelance couriers who accept or reject jobs (a freelancer model with accept/reject may come in a later version)`. Change nothing else in that paragraph.
2. In root `README.md` under "What's implemented", append a subsection **"Stage 3 foundation (M1)"** listing: Company/City/Hub, scoped users, merchants with optional login, drivers with home hub, per-request token validation.
3. In the "API overview" section add tables for `/cities`, `/hubs`, `/merchants`, `/drivers` and `/health` mirroring the authorization matrix above (method, route, roles, notes). Update the `/users` table: "creates DISPATCHER only; role is immutable".
4. In `README.md` "Getting started" add one line: `npm run test:e2e:setup` before `test:e2e:migrate`, and mention `.env.test.example`.
5. Do NOT edit `apps/api/README.md`.

**Gate:** FULL GATE; `git status` clean.
**Commit:** `test+docs(m1): cross-tenant isolation sweep and README updates`

---

## M1 DEFINITION OF DONE (all must be true)

- [ ] FULL GATE green on the branch from a fresh test DB (`dropdb`-free: run `npm run test:e2e:migrate` then `npm run test:e2e:all`).
- [ ] Migration applies cleanly to a DB that already contains the dev admin user, and to an empty DB.
- [ ] Every route in the authorization matrix has tests for: success, 401, 403 (where applicable), 404 for cross-tenant ids, 400 for invalid input.
- [ ] A deactivated or soft-deleted user's existing access token is rejected immediately.
- [ ] `/users` can only create DISPATCHER; roles are immutable via API.
- [ ] No response contains any secret field (spot-check each module's response in a test: `expect(body).not.toHaveProperty('passwordHash')`).
- [ ] No class-level `@Roles`; every handler has `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`.
- [ ] ADRs 0001–0010 present; README updated.
- [ ] MILESTONE REPORT printed.

---

# SPECIFICATIONS FOR LATER MILESTONES (NOT EXECUTABLE YET)

> Do **not** implement anything below until the human issues a new, command-level task list for that milestone. These sections fix the design so the work is consistent; details marked **[CONFIRM]** are decided at kickoff.

## M2 — PARCEL CORE

**Entities**
- `Parcel`: `id, companyId, trackingNumber, merchantId, originCityId (= merchant.cityId at creation), destinationCityId, receiverName, receiverPhone, receiverAddress, weightGrams Int?, lengthMm/widthMm/heightMm Int?, shippingFeeMinor Int, codAmountMinor Int @default(0), amountDueFromReceiverMinor Int (= shippingFee + cod), currency @default("MAD"), intake enum (COMPANY_PICKUP | HUB_DROPOFF), status ParcelStatus, direction enum (FORWARD | RETURN) @default(FORWARD), custodianType enum (MERCHANT | DRIVER | HUB | RECEIVER)?, custodianId String?, batchId?, createdAt, updatedAt, cancelledAt?`. `@@unique([companyId, trackingNumber])`.
- `ParcelStatus` [CONFIRM final table]: `CREATED, PICKED_UP, AT_HUB, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RETURNED, CANCELLED`. Allowed transitions: CREATED→PICKED_UP | AT_HUB | CANCELLED; PICKED_UP→AT_HUB; AT_HUB→IN_TRANSIT | OUT_FOR_DELIVERY | CANCELLED; IN_TRANSIT→AT_HUB; OUT_FOR_DELIVERY→DELIVERED | AT_HUB | RETURNED (RETURNED only when `direction = RETURN`); DELIVERED, RETURNED, CANCELLED are terminal.
- `ParcelEvent` (append-only): `id, companyId, parcelId, type, fromStatus?, toStatus?, actorUserId?, hubId?, legId?, note?, metadata Json?, createdAt`.
- `PickupRequest`: `id, companyId, merchantId, pickupAddress, requestedAt, status (REQUESTED | CONFIRMED | REJECTED | CANCELLED), handledByUserId?, rejectionReason?`; confirming it creates nothing automatically — the dispatcher then registers parcels against it **[CONFIRM]**.
- `Tariff`: `id, companyId, fromCityId, toCityId, priceMinor Int, currency`, `@@unique([companyId, fromCityId, toCityId])`.
- `ParcelBatch` (merchant-side grouping only): `id, companyId, merchantId, label?, createdAt`.

**Rules:** tracking number server-generated (prefix `DX-` + 10 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` using `randomBytes`), retried on unique collision. Shipping fee copied from the tariff at creation (no tariff → 422). **Receiver pays shipping:** `amountDueFromReceiverMinor = shippingFeeMinor + codAmountMinor`; merchant settlement later covers COD only. All status changes go through one `ParcelStateMachine` service that also writes the `ParcelEvent` and updates custody in the same transaction (ADR-0004/6/7).

**API:** pickup-request CRUD/confirm/reject/cancel; `POST /parcels` (MERCHANT for own merchant; DISPATCHER/ADMIN with `merchantId`); `GET /parcels` + `GET /parcels/:id` (merchant: own only; dispatcher/admin: company-wide in M2, refined in M4); `POST /parcels/batch` (several parcels in one request, atomic); `POST /parcels/:id/cancel` (only from CREATED or AT_HUB with no active run); public throttled `GET /track/:trackingNumber` returning only status, city names, and timeline labels (no phone/address/amounts).

**Tests:** every legal and illegal transition (table-driven); event row per transition; fee math; tariff missing; merchant isolation; public tracking leaks nothing; batch atomicity.

## M3 — LEGS AND ROUTING

- `Leg`: `id, companyId, parcelId, type (PICKUP|LINEHAUL|DELIVERY), direction (FORWARD|RETURN), fromKind/fromHubId/fromAddress, toKind/toHubId/toAddress, sequence Int, status (PLANNED|IN_PROGRESS|DONE|SUPERSEDED|CANCELLED), supersededByLegId?, supersededReason?, runId?, createdAt, updatedAt`. No unique on `(parcelId, type)` (returns and re-plans create more legs).
- `routing` module (`RoutePlanner.plan(parcel)` is a pure function over parcel + hubs): COMPANY_PICKUP + same city → PICKUP(merchant→hub), DELIVERY(hub→receiver); COMPANY_PICKUP + different city → PICKUP, LINEHAUL(hubA→hubB), DELIVERY; HUB_DROPOFF → same without PICKUP; RETURN direction → reverse of the remaining path ending at the merchant. Exactly one active hub per city is required; otherwise 422 (ADR-0009).
- Re-plan: unfinished legs → SUPERSEDED (kept, with reason and link), new legs appended with new sequence numbers; DONE legs are never touched.
- Hub receipt scan: `POST /hubs/:hubId/receipts { trackingNumber }` by a dispatcher of that hub → custody becomes the hub, parcel status AT_HUB, event written; a parcel expected elsewhere creates an `ExceptionCase` (type MISDIRECTED) **[CONFIRM exceptions model]**.
- **Tests:** table-driven planner cases (all intake × city combinations, returns, re-plan with a DONE first leg), receipt scan scoping.

## M4 — RUNS AND DISPATCH

- `Run`: `id, companyId, type (LINEHAUL|PICKUP_ROUND|DELIVERY_ROUND), originHubId, destinationHubId?, status (DRAFT|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED), createdByUserId, createdAt, updatedAt`.
- `Assignment`: `id, companyId, runId, driverId, assignedByUserId (FK to User), status (ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED), notes?, createdAt, updatedAt`. Created **only** through `assignDriver(run, driver, actor)` (ADR-0002). At most one non-cancelled assignment per run (partial unique index via raw SQL migration).
- Rules: a LINEHAUL run only accepts legs with the same from/to hub; dispatcher may only manage runs whose `originHubId` is their hub (destination-hub dispatcher then manages the delivery rounds); reassignment cancels the old assignment (kept) and creates a new one; a driver cannot have two IN_PROGRESS assignments.
- Driver API: `GET /driver/runs`, `POST /driver/runs/:id/start`, per-leg `pickup` / `handover` / `deliver` actions that call the parcel state machine.
- **Tests:** scoping, consolidation rule, reassignment history, driver sees only own runs, illegal transitions.

## M5 — DELIVERY ATTEMPTS, EXCEPTIONS, RETURNS

- `DeliveryAttempt`: `id, companyId, legId, parcelId, attemptNumber, outcome (DELIVERED|FAILED), failureReason enum (RECEIVER_UNREACHABLE|WRONG_ADDRESS|REFUSED|RESCHEDULED|OTHER), note?, attemptedAt, driverId`.
- `Company.maxDeliveryAttempts Int @default(3)`. After the max failures the parcel becomes eligible for return; a dispatcher triggers `POST /parcels/:id/return`, which flips `direction` to RETURN and invokes the planner for reverse legs.
- `ExceptionCase` queue (MISDIRECTED, DAMAGED, COUNT_MISMATCH, LOST) with open/resolved state and notes.
- **Tests:** full failed-attempt → return round trip across two hubs, exception creation on count mismatch.

## M6 — COD AND SETTLEMENT

- `CodCollection` (`id, companyId, parcelId, driverId, amountMinor, status COLLECTED|HANDED_OVER|CONFIRMED|DISCREPANCY`), `CashHandover` (`id, companyId, hubId, driverId, totalMinor, confirmedByUserId, confirmedAt`; **confirmed by a dispatcher** — decision recorded), `MerchantSettlement` (`id, companyId, merchantId, totalMinor, status DRAFT|PAID, createdAt, paidAt?`) with `SettlementLine` per parcel. Append-only: corrections are new rows, never updates of amounts.
- Receiver pays the shipping fee at the door: the driver collects `amountDueFromReceiverMinor`. Settlement pays the merchant the COD part only; the shipping fee is company revenue.
- **Tests:** totals reconcile; a DISCREPANCY item blocks settlement for that parcel; amounts never mutated.

## M7 — HARDENING AND V1 RELEASE

Audit log (admin/assignment/cash actions), unit tests for state machines and planner, OpenAPI, threat-model pass, module-boundary lint rule (cross-module imports only through each module's `index.ts`), backups and restore drill, Dockerfile + deployment pipeline, runbook, and the dispatcher web frontend (parallel track from M2 on).

## EXPLICITLY NOT IN V1
QR codes, proof-of-delivery photos/signatures, live GPS, notifications, freelancer offers/accept/reject, multi-company onboarding and billing, vehicle capacity, route optimization, Redis, Kafka, ABAC.

---

## END OF DOCUMENT
Reminder: if anything here conflicts with what you see in the repository, **do not resolve it yourself — STOP and report.**
