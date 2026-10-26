# IndoBengkel

IndoBengkel connects vehicle owners with motorcycle and car workshops: discover a nearby workshop, book a service, follow the repair, shop parts in **BengkelShop**, and chat with the workshop.

This repository is the **working local baseline**: a Next.js frontend, a NestJS API, PostgreSQL, seeded demo data, real image uploads (file + camera), and one Docker Compose command to run everything.

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
| Orchestration | Docker Compose (`db`, `redis`, `backend`, `frontend`) |
| Demo data | 24 workshops (23 active), 30 users, 372 services, 72 mechanics, 120 products, 40 service orders, 12 orders, 84 reviews |

Production integrations that are **not** wired yet: Midtrans, Mailpit/email
outbox, MinIO/S3 presigned uploads, and Socket.IO. See "Known gaps".

---

## Quick start (Docker)

```bash
docker compose up --build
```

Open **http://localhost:3000**.

The backend applies versioned migrations (`prisma migrate deploy`), seeds the database (this **resets demo data to the snapshot**), then starts the API on port 4000. PostgreSQL is exposed on host port **55432** because 5432 is commonly occupied by a local PostgreSQL install. Redis is exposed on **127.0.0.1:6379** and holds the shared rate-limit counters; it is not persisted because the counters are ephemeral. If a local Redis already occupies 6379, change the host mapping in `docker-compose.yml`; host-run tests then need the matching `REDIS_URL`.

```bash
docker compose ps
docker compose logs -f backend
docker compose down          # keep database + uploads
docker compose down -v       # reset database + uploads
```

Health check: **http://localhost:4000/api/v1/health**

### Demo accounts

All seeded users use password `password123`.

| Role | Email |
|---|---|
| Customer | `rina@indobengkel.test` |
| Workshop owner | `andi@kawahmotor.test` (Kawah Motor Works) |
| Other owners | `ownerN@indobengkel.test` where N is the seeded workshop index |
| Other customers | See `IndoBengkelBE/prisma/seed-data.json` |

The login screen also has one-click demo buttons for a customer and the workshop owner.

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
npm run db:seed
# .env: REDIS_URL=redis://localhost:6379/0 (optional; memory fallback without it)
npm run start:dev
```

Frontend:

```bash
cd IndoBengkelFE
npm install
# .env.local
# NEXT_PUBLIC_USE_MOCK_API=false
# API_INTERNAL_URL=http://localhost:4000
npm run dev
```

`IndoBengkelFE` can also run without a backend using the original mock API:

```
NEXT_PUBLIC_USE_MOCK_API=true
```

That mode stores data in `localStorage` and is intended only for design/demo work.

---

## Useful commands

| Command | Where | Purpose |
|---|---|---|
| `npm run build` | FE / BE | Production build |
| `npm run typecheck` | FE / BE | TypeScript check |
| `npm test` | BE | API integration suites (isolated test schema) |
| `npm run test:e2e` | root | Playwright browser suite against the Docker stack |
| `npm run db:seed` | BE | Reset the database to the seed snapshot |
| `npm run db:migrate` | BE | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev -- --name <name>` | BE | Create + apply a migration from `schema.prisma` |
| `npm run db:status` | BE | Show applied/pending migrations |
| `npm run start:dev` | BE | Nest watch mode |
| `POST /api/v1/demo/reset` | API | Reset demo data to the seed snapshot |

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
| `docker compose up -d --build` | root | Rebuild and start the full stack |

Reset demo data:

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset
```

---

## API

Base URL: **`http://localhost:4000/api/v1`**. The frontend calls it same-origin at `/api/v1` through a Next.js rewrite, so the session cookie stays first-party.

Main groups:

- `auth` — login, register, logout, session, locale
- `workshops`, `products` — public catalogue, availability
- `vehicles` — customer garage
- `service-orders` — booking, estimate approval, payment simulation
- `cart`, `orders`, `reviews` — BengkelShop checkout and reviews
- `workshop/*` — owner console (profile, mechanics, services, products, bookings, orders, reviews, dashboard)
- `conversations`, `notifications` — chat and in-app notifications
- `demo/reset`, `health`

Responses use `{ data }` for single resources and `{ data, meta }` for paginated lists. Errors use:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "…" } }
```

---

## Uploads

Every image field uses the same client pipeline (`IndoBengkelFE/src/lib/upload-image.ts`): validate → downscale to 1280 px → compress to ≤340 KB → upload with real XHR progress. The UI supports drag & drop, file picker, and camera capture with a file-picker fallback.

The route handler writes to `public/uploads`; because `next start` does not serve public files added after build, files are served through `GET /api/uploads/[name]`. Docker mounts the `indobengkel-uploads` volume so images survive container restarts.

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

- Midtrans + signed webhook (current payment is a local simulation)
- Email delivery/Mailpit and email verification enforcement
- Socket.IO realtime chat (currently REST + refetch)
- MinIO/S3 presigned uploads; uploads are session-gated but not tracked per
  owner in the database
- Contract gaps listed in `docs/TESTING.md` (for example, confirmation does not
  re-check slot capacity)
- Multi-photo products and richer reports

Automated API (Jest + Supertest) and browser (Playwright) suites plus CI are in
place; see `docs/TESTING.md`.

The local baseline is designed so these can be added without changing the UI contract.
