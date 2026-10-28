# IndoBengkel

IndoBengkel connects vehicle owners with motorcycle and car workshops: discover a nearby workshop, book a service, follow the repair, shop parts in **BengkelShop**, and chat with the workshop.

This repository is the **working local baseline**: a Next.js frontend, a NestJS API, PostgreSQL, an explicit development seed, real image uploads (file + camera), and one Docker Compose command to run everything.

> Design and product specifications live in `docs/`. The runtime status is documented in `docs/TSD.md` and `docs/PLAN.md` v1.2.

---

## Stack

| Layer | Implementation |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, TanStack Query |
| Backend | NestJS 11, Prisma 6, cookie session auth (`ib_session`), bcryptjs |
| Database | PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`) |
| Rate limiting | Redis 7 (`redis:7-alpine`), shared counters; falls back to process memory when Redis is unavailable |
| Uploads | `POST /api/uploads` → `public/uploads` volume, served by `GET /api/uploads/[name]` |
| Payments | Local test provider by default, Midtrans Core API adapter + signed webhook, VA/transfer/QRIS instructions, cron expiry |
| Orchestration | Docker Compose (`db`, `redis`, `backend`, `frontend`) |
| Development seed | 24 workshops (23 active), 30 users, 372 services, 72 mechanics, 120 products, 40 service orders, 12 orders, 84 reviews |

Production integrations that are **not** wired yet: live Midtrans credentials, email delivery, MinIO/S3 presigned uploads, and Socket.IO. See "Known gaps".

---

## Quick start (Docker)

```bash
npm run stack:up
```

This builds the stack, applies migrations, and runs the development seed **once**. Open **http://localhost:3000**.

The backend applies versioned migrations (`prisma migrate deploy`) and then starts the API on port 4000. It does **not** seed on startup; `npm run stack:seed` runs the seed explicitly and is destructive. PostgreSQL is exposed on host port **55432** because 5432 is commonly occupied by a local PostgreSQL install. Redis is exposed on **127.0.0.1:6379** and holds the shared rate-limit counters; it is not persisted because the counters are ephemeral. If a local Redis already occupies 6379, change the host mapping in `docker-compose.yml`; host-run tests then need the matching `REDIS_URL`.

```bash
docker compose ps
docker compose logs -f backend
npm run stack:seed          # reset the local database to the seed snapshot
docker compose down         # keep database + uploads
docker compose down -v      # reset database + uploads
```

Health check: **http://localhost:4000/api/v1/health**

### Development seed

The seed is for local development and automated tests only. It truncates the
application tables and recreates the dataset in
`IndoBengkelBE/prisma/seed-data.json`. Set `SEED_PASSWORD` before seeding to
override the local default password, for example
`SEED_PASSWORD=your-local-password npm run stack:up` (PowerShell: set
`$env:SEED_PASSWORD` first). Never run the seed against a production database.

The login page has no pre-filled accounts or one-click role switcher. Sign in
with an email from the seed data and the password you seeded.

---

## Local development (without Docker)

Start PostgreSQL and Redis (Redis is optional if you run a single API instance):

```bash
docker compose up -d db redis
```

Backend:

```bash
cd IndoBengkelBE
npm install
npx prisma generate
npm run db:migrate
npm run build
SEED_PASSWORD=your-local-password npm run db:seed
# .env: REDIS_URL=redis://localhost:6379/0 (optional; memory fallback without it)
npm run start:dev
```

On PowerShell, set the variable first:

```powershell
$env:SEED_PASSWORD = "your-local-password"
npm run db:seed
```

Frontend:

```bash
cd IndoBengkelFE
npm install
# .env.local
# API_INTERNAL_URL=http://localhost:4000
npm run dev
```

The frontend always talks to the NestJS API through the Next.js rewrite; there is
no standalone local-storage mode.

---

## Useful commands

| Command | Where | Purpose |
|---|---|---|
| `npm run build` | FE / BE | Production build |
| `npm run typecheck` | FE / BE | TypeScript check |
| `npm test` | BE | API integration suites (isolated test schema) |
| `npm run test:e2e` | root | Playwright browser suite against the Docker stack |
| `npm run stack:up` | root | Build/start the stack and seed it once |
| `npm run stack:seed` | root | Reset the local database to the seed snapshot |
| `npm run db:seed` | BE | Reset the database to the seed snapshot |
| `npm run db:migrate` | BE | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev -- --name <name>` | BE | Create + apply a migration from `schema.prisma` |
| `npm run db:status` | BE | Show applied/pending migrations |
| `npm run start:dev` | BE | Nest watch mode |

### Database changes

`IndoBengkelBE/prisma/migrations` is the source of truth for the schema. The
baseline is `0_init`; `1_postgis_workshop_location` adds the PostGIS extension and
the GiST expression index used for nearest-workshop search. The Docker stack and CI
run `prisma migrate deploy`, and CI fails if `schema.prisma` drifts from the
committed migrations.

```bash
cd IndoBengkelBE
npm run db:migrate:dev -- --name add_pickup_code   # author a migration
npm run db:migrate                                 # apply what is pending
```

`prisma db push` remains only for throwaway prototypes and the isolated test
schema, where replaying migrations would add nothing.

If your PostgreSQL volume predates the migration baseline (it was created by
`db push`), mark the baseline once so the first `migrate deploy` does not try to
recreate existing tables:

```bash
cd IndoBengkelBE
npx prisma migrate resolve --applied 0_init
npm run db:migrate                                 # applies 1_postgis_workshop_location
```

---

## API

Base URL: **`http://localhost:4000/api/v1`**. The frontend calls it same-origin at `/api/v1` through a Next.js rewrite, so the session cookie stays first-party.

Main groups:

- `auth` — login, register, logout, session, locale
- `workshops`, `products` — public catalogue, availability
- `vehicles` — customer garage
- `service-orders` — booking, estimate approval, pending invoice payment + local settlement
- `cart`, `orders`, `reviews` — BengkelShop checkout, local payment, reviews
- `workshop/*` — owner console (profile, mechanics, services, products, bookings, orders, reviews, dashboard)
- `conversations`, `notifications` — chat and in-app notifications
- `health`

Responses use `{ data }` for single resources and `{ data, meta }` for paginated lists. Errors use:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "…" } }
```

---

## Payments (local-first)

`PAYMENT_PROVIDER=fake` is the default for local, Docker and CI. It never makes a
network call and only produces local test instructions, so it must never be used
for real money.

- `POST /orders` creates the order and a pending `Payment` (VA, transfer or QRIS).
- `POST /orders/:id/pay` settles a payment for the local test provider. It is
  idempotent when the order is already paid and returns `409` for a cancelled or
  expired order.
- `POST /service-orders/:id/pay` creates or refreshes one pending invoice payment;
  `POST /service-orders/:id/simulate-paid` settles it. Cash is recorded as a
  `Payment` with provider `cash`.
- A cron runs every minute, locks each expired payment, marks the shop order
  `expired` and restores stock, or marks the service invoice payment `expired`
  so the customer can retry. `PAYMENT_EXPIRY_ENABLED=false` disables it in tests.
- `PAYMENT_PROVIDER=midtrans` uses the Midtrans Core API. It requires
  `MIDTRANS_SERVER_KEY`; startup fails without it, so there is no silent
  fallback. Keep `PAYMENT_PROVIDER=fake` for local, Docker and CI.
- Midtrans calls `POST /api/v1/payments/midtrans/notification`. The endpoint is
  public, exempt from CSRF, verifies
  `SHA512(order_id + status_code + gross_amount + serverKey)`, checks the amount,
  and applies the same locked state transitions as the local settlement.
- Optional Midtrans settings: `MIDTRANS_IS_PRODUCTION=false`,
  `MIDTRANS_VA_BANK=bca`, `MIDTRANS_QRIS_ACQUIRER=gopay`.

The frontend shows the local settlement button only when
`payment.provider === "fake"`, renders Midtrans QRIS as an image, and polls
pending payments until they are paid or expired.

---

## Uploads

Every image field uses the same client pipeline (`IndoBengkelFE/src/lib/upload-image.ts`): validate → downscale to 1280 px → compress to ≤340 KB → upload with real XHR progress. The UI supports drag & drop, file picker, and camera capture with a file-picker fallback.

The route handler writes to `public/uploads`; because `next start` does not serve public files added after build, files are served through `GET /api/uploads/[name]`. Docker mounts the `indobengkel-uploads` volume so images survive container restarts. After writing a file the route records its owner through `POST /api/v1/uploads`; the API rejects references to another account's upload, so a file URL cannot be attached to someone else's profile, vehicle, product or job.

If storage is unavailable, the client falls back to an inline data URL so the flow can still complete.

---

## Project layout

```
IndoBengkel/
├─ docker-compose.yml
├─ docs/                     PRD, FSD, TSD, PLAN
├─ design/                   design notes and .pen canvas
├─ IndoBengkelBE/            NestJS API + Prisma schema + seed
├─ IndoBengkelFE/            Next.js app + upload route
└─ IndoBengkelDB/            exported seed snapshot
```

---

## Known gaps

These are intentionally deferred to production hardening:

- Midtrans reconciliation/refund flow (adapter, signed webhook and settlement
  are in place; refunds and payment-event history are not)
- Email delivery and real email-verification tokens (the current endpoint only
  verifies the signed-in account)
- Socket.IO realtime chat (currently REST + refetch)
- MinIO/S3 presigned uploads (uploads are stored on the web tier's local disk;
  ownership is tracked in the `Upload` table)
- Multi-photo products and richer reports

Automated API (Jest + Supertest) and browser (Playwright) suites plus CI are in
place; see `docs/TESTING.md`.

The local baseline is designed so these can be added without changing the UI contract.
