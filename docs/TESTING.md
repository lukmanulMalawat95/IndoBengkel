# Testing

Two layers guard the local baseline:

| Layer | Tool | Location | What it proves |
|---|---|---|---|
| API integration | Jest + Supertest (in-process Nest app) | `IndoBengkelBE/test/*.e2e-spec.ts` | Auth, ownership, booking state machine, stock/reservation, chat |
| Browser end-to-end | Playwright (Chromium) | `tests/*.spec.ts` | The same journeys through the real Next.js UI and Docker stack |

---

## API integration tests

```bash
npm run test:api     # from the repo root
cd IndoBengkelBE && npm test
cd IndoBengkelBE && npm run test:watch
```

The suite does **not** touch the local development schema. `test/setup-env.ts` rewrites
`DATABASE_URL` to the `indobengkel_test` PostgreSQL schema, and
`test/global-setup.ts` runs `prisma db push` plus the curated seed before the
first test. This is intentional: the schema is disposable, so replaying
production migrations would only slow the suite. Docker and CI use
`prisma migrate deploy` against the real schema. Point it elsewhere with `TEST_DATABASE_URL` (the URL must include a
`schema` parameter).

Requirements: PostgreSQL reachable at the URL in `IndoBengkelBE/.env`
(`localhost:55432` when the Docker `db` service is up). Redis is optional for
the suites: set `REDIS_URL=redis://localhost:6379/0` to run the Redis store
test and exercise the distributed limiter (CI does both).

### Coverage

| Suite | Guarantees |
|---|---|
| `auth.e2e-spec.ts` | Register/login/logout, duplicate email, short password, session cookie, `me`, locale, public vs guarded routes, email verification |
| `discovery.e2e-spec.ts` | Active-only catalogue, PostGIS distance ordering + haversine parity, radius/type/rating/name/`openNow` filters (SQL parity with the serialized flag), pagination meta incl. pages beyond the last, workshop detail, draft hidden + 404, availability slots, capacity reflected after confirmation |
| `booking-lifecycle.e2e-spec.ts` | Booking snapshot and validation, hourly-slot/opening-hours/closure rules, vehicle-type mismatch, draft workshop, confirm → start → complete → pending payment → simulate paid, one reusable payment row, payment expiry + retry, capacity re-checked on confirmation, odometer only changes on completion, 150% approval, reject → in_progress, cash payment with provider `cash`, cancellation window, decline, no-show, mechanic required |
| `shop-order.e2e-spec.ts` | Cross-workshop cart ownership, quantity clamp, stock reservation/restore, order creation notification type, idempotent simulated payment, cron expiry restoring stock, pickup code verification, product reviews locked until completed + comment length, weight-based shipping, tracking required, delivery confirmation, empty cart, out of stock |
| `midtrans-provider.e2e-spec.ts` | Core API charge body for VA/QRIS, Basic auth header, VA/QR action mapping, SHA512 signature verification, invalid signature rejection, settlement/capture/expire/deny/cancel/failure/refund status mapping |
| `midtrans-webhook.e2e-spec.ts` | Signed webhook settlement for a shop order, idempotent replay, invalid signature 401, amount mismatch 400, expire notification restoring stock |
| `uploads.e2e-spec.ts` | Upload metadata validation, owner recorded on upload, idempotent re-registration, name conflicts across accounts, owner-only references on vehicles and workshop profiles, external URLs untouched |
| `messaging.e2e-spec.ts` | Conversation uniqueness, message validation, two-sided delivery, unread count, read receipts, cross-workshop isolation, notifications |
| `authorization.e2e-spec.ts` | IDOR on bookings, vehicles and catalogue, customer blocked from the workshop console, anonymous requests rejected |
| `security.e2e-spec.ts` | Cookie flags, CSRF 403/201, login 429 + `Retry-After` (Redis path when `REDIS_URL` is set) |
| `rate-limit-store.e2e-spec.ts` | Redis Lua counter increments 1→2 and keeps a TTL; skipped when `REDIS_URL` is unset |

### Test data

Suites create their own workshops, mechanics, services, products, vehicles and
customers through the API, so they do not depend on seeded IDs. Only discovery
assertions use the seeded catalogue.

`test/global-setup.ts` runs `prisma db push` against the isolated
`indobengkel_test` schema, then recreates the PostGIS extension and the
`Workshop_location_gist` index from `1_postgis_workshop_location`: `db push` only
manages objects Prisma models. Nearest-search tests fail loudly if that step is
skipped.

`test/setup-env.ts` forces `PAYMENT_PROVIDER=fake` and
`PAYMENT_EXPIRY_ENABLED=false`. The cron is disabled so a background tick cannot
race fixtures; expiry tests call `PaymentsService.expirePendingPayments()`
directly and assert stock, status and notifications deterministically.

---

## Browser E2E

```bash
npm run stack:up     # build, start and seed the Docker stack once
npm run test:e2e     # Playwright, Chromium + mobile project
```

`E2E_BASE_URL` overrides the default `http://localhost:3000`; the API health
check can be pointed elsewhere with `E2E_API_URL`. A global setup waits for the
API and runs the seed inside the Docker backend so every run starts from the
curated snapshot. The suite runs with one worker because the specs share the
local database, and each spec creates unique users, bookings and orders through
the UI.

Covered journeys (9 tests):

| Spec | Journey |
|---|---|
| `discovery.spec.ts` | Search Kawah, open the profile, switch tabs; motorcycle filter; anonymous guard |
| `booking.spec.ts` | Customer wizard → owner confirm/start/finish/cash → paid → service review; seeded completed invoice → pay online (QR) → simulate settlement → paid |
| `shop.spec.ts` | Add a Kawah product → checkout pickup → pay → owner prepares/ready/verify code → product review |
| `chat.spec.ts` | Customer sends a message → owner replies → customer sees the reply |
| `mechanics.spec.ts` | Owner adds a mechanic with a real photo upload, survives a reload |
| `mobile.spec.ts` | Home, discovery and workshop detail fit a Pixel 7 viewport without horizontal scroll |

Artifacts land in `playwright-report/` and `test-results/` (both git-ignored).
Open the report with `npm run test:e2e:report`.

---

## CI

`.github/workflows/ci.yml` runs three jobs:

1. **backend** - Postgres 16 and Redis 7 services, `prisma generate`,
   `prisma migrate deploy` against an empty database, a drift check
   (`migrate diff --exit-code`), then typecheck, build and the API suites (the
   security spec's rate-limit assertions and the Redis store test run against
   Redis).
2. **frontend** — typecheck and production build.
3. **e2e** — `docker compose up -d --build`, waits for `/api/v1/health` and the
   web app, then Playwright's global setup seeds the backend and runs the
   browser suite; uploads the report and stack logs on failure and always tears
   the stack down.

---

## Security baseline

The API suites run with the production controls disabled so fixtures stay
cheap; `test/security.e2e-spec.ts` turns them back on per test and asserts the
behaviour.

| Control | Behaviour |
|---|---|
| CSRF | Double-submit cookie `ib_csrf` + `X-CSRF-Token` on every authenticated mutation. Bootstrap endpoints (login, register) are exempt; logout and purchases are not. |
| Session cookie | `ib_session`, httpOnly, SameSite=Lax, 7-day max age; `Secure` when `COOKIE_SECURE=true`. |
| Rate limit | Fixed window per IP (1200/min globally) plus tighter per-route buckets: login/register 10/min per IP+email, chat send 30/min, reviews 10/min. Counters live in Redis when `REDIS_URL` is set (shared across replicas) and in process memory otherwise. |
| Uploads | `POST /api/uploads` validates the session against `GET /auth/me`, enforces 5 MB and jpg/png/webp magic bytes, randomises the filename, then records the owner through `POST /api/v1/uploads`. Every authenticated mutation rejects `/api/uploads/...` references the caller does not own (`UPLOAD_NOT_OWNED`). |
| Headers | Helmet (CSP off for the JSON API, CORP cross-origin); CORS restricted to `CORS_ORIGIN` and `X-CSRF-Token`. |

Relevant environment variables: `COOKIE_SECURE`, `TRUST_PROXY`,
`CSRF_ENABLED`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_GLOBAL`, `REDIS_URL`,
`PAYMENT_PROVIDER`, `PAYMENT_EXPIRY_ENABLED`, `MIDTRANS_SERVER_KEY`,
`MIDTRANS_IS_PRODUCTION`, `MIDTRANS_VA_BANK`, `MIDTRANS_QRIS_ACQUIRER`. Never
disable the CSRF/rate-limit toggles outside tests. With `REDIS_URL` set, the
security suite exercises the Redis store; CI starts a Redis 7 service for this.

`PAYMENT_PROVIDER=fake` remains the default and is required for simulation
endpoints. `PAYMENT_PROVIDER=midtrans` requires `MIDTRANS_SERVER_KEY` and fails
at startup without it; do not weaken that check to make a deployment boot.

These are intentional baseline limitations, not test failures:

- Rate limits are shared through Redis when `REDIS_URL` is set. If Redis is
  unreachable, the guard falls back to per-process memory so the API stays
  available; during a sustained outage each replica enforces its own counters.
- Chat is REST + refetch; no Socket.IO, so there is no realtime assertion.
- Uploads are stored on the web tier's local disk, not an object store; the
  ownership record makes the URL safe to reference, but the file itself is not
  deduplicated or garbage-collected.
- Default suites use the fake provider. Midtrans is tested with a mocked Core API
  `fetch` and locally signed webhook payloads; no live sandbox request or real
  credential is used. The UI shows the simulation button only when
  `payment.provider === "fake"`.

The booking, review, upload and payment rules that used to be documented here as
gaps now have regression tests: hourly slots + closures (`booking-lifecycle`),
capacity re-checked inside the confirmation transaction (`booking-lifecycle`),
review comment length (`booking-lifecycle`, `shop-order`), upload ownership
(`uploads`), idempotent simulated payments and expiry/stock restore
(`shop-order`, `booking-lifecycle`).
