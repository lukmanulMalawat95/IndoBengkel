# TSD — IndoBengkel v1.0

| Field | Value |
|---|---|
| Dokumen | Technical Specification |
| Versi | 1.2 (23 Oktober 2026) |
| Acuan | `SPEC.md`, `PRD.md` v1.2, `FSD.md` v1.2 |
| Status | Final untuk MVP — baseline lokal (FE + API + DB + Docker) berjalan; target produksi ditandai |
| Target runtime | Docker Compose lokal: Next.js 15 + NestJS 11 + PostgreSQL 16 + Redis 7; mode mock FE opsional |

**Status implementasi (25 Oktober 2026)**

| Area | Berjalan sekarang | Target produksi (belum) |
|---|---|---|
| FE | Seluruh layar customer/workshop, EN/ID, Night Shift/Day Shift, skeleton loading | — |
| API | NestJS `/api/v1`: auth, katalog, kendaraan, booking, commerce, konsol bengkel, chat, notifikasi, demo reset, health | Swagger, email verification, webhook |
| DB | PostgreSQL 16 + PostGIS 3.4 + Prisma, 15 model, migrasi berversi (`0_init`, `1_postgis_workshop_location`), seed deterministik (24 bengkel/23 aktif) | `email_outbox`, backup |
| Auth | Cookie `ib_session` httpOnly + tabel `sessions`, bcrypt, CSRF + rate limit (Redis, fallback memory) | Access/refresh JWT rotation, verified guard |
| Upload | `POST /api/uploads` → disk, session + MIME + magic bytes + 5 MB; owner dicatat di tabel `Upload` | Presigned S3/MinIO |
| Bayar | Simulasi VA/QRIS/transfer + cash | Midtrans Core API + webhook signature |
| Chat | REST + refetch/polling | Socket.IO |
| Geo | PostGIS KNN + radius + `open_now` di SQL (`geography` expression index) | pg_trgm, Photon geocoder |
| Docker | `db`, `redis`, `backend`, `frontend`; healthcheck + volume upload | MinIO, Mailpit, Photon |

---

## 1. Prinsip Teknis

1. **Satu sumber kebenaran uang di database.** Semua nominal integer rupiah; tidak ada float.
2. **Transisi state eksplisit.** Tidak ada update status bebas; setiap transisi lewat service domain yang memvalidasi state asal.
3. **Otorisasi di server, bukan di UI.** Setiap endpoint memeriksa kepemilikan resource.
4. **Uang & stok aman terhadap konkurensi.** Transaksi + lock; tidak ada `read-modify-write` tanpa proteksi.
5. **Tanpa vendor berbayar.** Pembayaran simulasi + seed deterministik; Mailpit/MinIO adalah target produksi.
6. **Satu arah dependensi.** Controller → service → repository/infra. Tidak ada akses Prisma dari controller.
7. **i18n sejak awal.** Tidak ada string UI di dalam logika.

---

## 2. Arsitektur

```
┌──────────────────────────── Browser ────────────────────────────┐
│  Next.js 15 (App Router, RSC)                                   │
│  - [locale] routes, next-intl                                   │
│  - httpOnly session cookie `ib_session` + `sessions` table           │
│  - /api/v1 rewrite → BE (same-origin cookies)                       │
│  - /api/uploads (local disk) → public/uploads                       │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ REST /api/v1                 │ WebSocket /chat
                ▼                              ▼
┌──────────────────────────── NestJS 11 ──────────────────────────┐
│ guards → pipes → controllers → services → repositories          │
│ modules: auth users workshops mechanics services vehicles       │
│          service-orders catalog cart orders payments reviews    │
│          chat notifications uploads reports geo mail           │
│ adapters: PaymentProvider(fake|midtrans)  Mailer(mailpit|resend)│
│           Storage(minio|s3)  Geocoder(photon)                   │
└───────┬───────────────┬───────────────┬───────────────┬─────────┘
        ▼               ▼               ▼               ▼
   PostgreSQL 16     MinIO           Mailpit         Photon/Nominatim
   + PostGIS         (S3 API)        (SMTP)          (HTTP, opsional Docker)
```

Redis 7 dipakai untuk counter rate limit (bukan untuk Socket.IO atau email outbox). Runtime lokal belum memakai Socket.IO atau email outbox; chat memakai refetch/polling. Diagram di atas adalah arsitektur target, sedangkan baseline yang berjalan sekarang dijelaskan di tabel status dan §3.

**Runtime yang berjalan.** Repo berisi `IndoBengkelFE` (Next.js 15) dan `IndoBengkelBE` (NestJS 11 + Prisma + PostgreSQL 16 + PostGIS 3.4 + Redis 7), dijalankan bersama lewat `docker-compose.yml`. FE memanggil `/api/v1` same-origin melalui rewrite Next ke `API_INTERNAL_URL`; auth memakai cookie `ib_session` httpOnly dan tabel `sessions`; data disimpan di PostgreSQL (bukan `localStorage`). Rate limit memakai counter Redis agar konsisten antar-replica, dengan fallback in-memory bila Redis tidak tersedia. Mode mock FE tetap ada (`NEXT_PUBLIC_USE_MOCK_API=true`) untuk demo tanpa backend. Upload lokal ditulis ke `public/uploads` dan disajikan lewat route handler `GET /api/uploads/[name]`. Pembayaran disimulasikan; MinIO, Mailpit, Socket.IO, dan Midtrans belum dijalankan.

---

## 3. Struktur Repo

```
IndoBengkel/
├─ docker-compose.yml               db + redis + backend + frontend, volume upload
├─ docs/{PRD,FSD,TSD,PLAN}.md
├─ IndoBengkelBE/
│  ├─ Dockerfile
│  ├─ prisma/schema.prisma          15 model aktif
│  ├─ prisma/seed-data.json         snapshot seed dari FE
│  ├─ src/
│  │  ├─ main.ts / app.module.ts
│  │  ├─ health.controller.ts
│  │  ├─ common/                    auth guard, filter, serializers, utils
│  │  ├─ auth/                      login, register, session, me, logout
│  │  ├─ catalog/                   workshop + produk publik
│  │  ├─ commerce/                  cart, order, payment simulasi, review
│  │  ├─ vehicles/
│  │  ├─ bookings/                  service order customer
│  │  ├─ workshop/                  konsol: profil, montir, layanan, produk,
│  │  │                             booking, order, review, dashboard
│  │  ├─ messaging/                 conversation, message, notification
│  │  ├─ demo/                      reset seed
│  │  ├─ prisma/                    PrismaService
│  │  └─ seed/                      seed + run
│  └─ tsconfig*.json / nest-cli.json
├─ IndoBengkelFE/
│  ├─ Dockerfile
│  ├─ next.config.ts                rewrite /api/* → API_INTERNAL_URL
│  ├─ src/app/[locale]/             route groups (customer, workshop, auth)
│  ├─ src/app/api/uploads/          POST upload + GET file
│  ├─ src/components/ui/            image-upload, skeleton, page-loading, ...
│  ├─ src/lib/api/                  http/client + hooks + mock fallback
│  ├─ src/lib/upload-image.ts       validasi → kompresi → XHR upload
│  └─ messages/{en,id}.json
└─ IndoBengkelDB/
   └─ seed-export.json              snapshot sumber seed
```

`IndoBengkelBE` dan `IndoBengkelFE` berisi kode yang berjalan. Skema dikelola lewat `prisma/migrations/` (baseline `0_init`); container start menjalankan `prisma migrate deploy`, lalu seed yang **mengosongkan tabel dan memuat snapshot** (perubahan demo hilang saat restart). Target produksi menambahkan `db_test`, MinIO, dan Mailpit.

---

## 4. Stack & Versi

| Layer | Berjalan sekarang | Target produksi |
|---|---|---|
| FE | Next.js 15 (App Router), TypeScript strict, Tailwind 3.4, shadcn/ui, next-intl, next-themes, TanStack Query, react-hook-form + zod | — |
| Peta | Leaflet + react-leaflet, tile OSM; jarak dari PostGIS KNN | Photon/geocoder, clustering |
| BE | NestJS 11, TypeScript strict, class-validator, bcryptjs, cookie sesi | Swagger, Socket.IO, argon2, pino |
| ORM | Prisma 6 + migrasi berversi | — |
| DB | PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`), lat/lng + GiST expression index | pg_trgm + citext |
| Rate limit | Redis 7 (`redis:7-alpine`); fixed window per IP (+email), fallback in-memory | Tuning limit per paket |
| Storage | `public/uploads` + route handler | MinIO/S3 presigned |
| Auth | `sessions` + cookie `ib_session` | access/refresh JWT + CSRF |
| Email | — | Mailpit, Resend/outbox |
| Payment | Simulasi VA/QRIS/transfer + cash | Midtrans Core API |
| Test | Jest + Supertest (50 default, 51 with Redis), Playwright (8 test), GitHub Actions CI | Coverage 70% + performance |
| Tooling | npm, ESLint, Prettier, Docker Compose, GitHub Actions | pnpm workspaces |

**Catatan Next.js:** semua halaman yang butuh data user memakai `fetch` server-side dengan cookie diteruskan; mutasi lewat client component + TanStack Query.

---

## 5. Model Data & Geo

**Baseline yang berjalan (15 tabel):** `User`, `Session`, `Workshop`, `Mechanic`, `Service`, `Product`, `Vehicle`, `ServiceOrder`, `Cart`, `Order`, `Payment`, `Review`, `Conversation`, `Message`, `Notification`. Katalog dan identitas dinormalisasi; transaksi menyimpan snapshot JSON agar riwayat tidak berubah saat katalog diedit:

| Kolom snapshot | Isi |
|---|---|
| `Order.items` | judul, harga satuan, qty, subtotal, produk |
| `Order.shipping` | kurir, alamat, ongkir, berat |
| `ServiceOrder.items` | layanan/part, qty, harga, subtotal |
| `ServiceOrder.photos` | URL foto pekerjaan |
| `Cart.items` | produk, qty, harga saat masuk cart |

`Workshop` menyimpan `lat`/`lng`; pencarian terdekat memakai **PostGIS KNN** di SQL, sedangkan detail satu bengkel masih memakai haversine di service. Rating dihitung dari review bengkel (review produk tidak masuk rating bengkel). Seed deterministik menghasilkan 24 bengkel (23 aktif), 30 user, 372 layanan, 72 montir, 120 produk, 40 service order, 12 order, 84 review, 3 conversation, dan 9 notifikasi.

**PostGIS (berjalan):** skema lengkap ada di `SPEC.md` §5. Nearest search memakai PostGIS, bukan haversine di service:

1. Migrasi `1_postgis_workshop_location` membuat extension dan GiST index ekspresi:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE INDEX "Workshop_location_gist" ON "Workshop"
     USING GIST ((public.ST_SetSRID(public.ST_MakePoint("lng", "lat"), 4326)::public.geography));
   ```
   Tidak ada kolom `Unsupported`/`location`: titik dihitung dari `lat`/`lng` sehingga `schema.prisma` tidak drift dan seed tetap menulis dua kolom biasa. Konsekuensinya setiap query geo wajib memakai ekspresi yang identik (lihat `WorkshopGeoRepository`), dan `prisma migrate diff` tetap bersih karena index ekspresi tidak dimodelkan Prisma.
2. `GET /workshops` memfilter tipe/rating/pencarian/`open_now`/radius, mengurutkan KNN, dan mem-paginate di SQL. `total` dihitung query terpisah agar `ORDER BY ... LIMIT` tetap memakai index. Haversine hanya dipakai untuk detail bengkel (satu baris).
3. Semua uang: `Int` (rupiah). Berat: `Int` gram. Rating: `Decimal(3,2)`.
4. `updated_at` dikelola Prisma (`@updatedAt`).
5. Soft delete hanya untuk `messages.deleted_at`; entitas lain memakai status/aktif.
6. Tabel teknis tambahan di luar SPEC: `email_outbox` (lihat §12).
7. Seed memakai ID deterministik (UUID tetap) agar relasi stabil dan bisa dijalankan ulang dengan `--reset`.
8. Semua referensi gambar disimpan sebagai URL (`string`); galeri sebagai `string[]` (maks 6). Nilai ini hanya berasal dari uploader, bukan input teks pengguna.

**Query nearest (KNN + radius):** `WorkshopGeoRepository` menyusun SQL dengan `Prisma.sql` (parameter terikat), memakai ekspresi titik yang sama dengan index:

```sql
SELECT w."id",
       ((public.ST_SetSRID(public.ST_MakePoint(w."lng", w."lat"), 4326)::public.geography
         OPERATOR(public.<->)
         public.ST_SetSRID(public.ST_MakePoint($lng::float8, $lat::float8), 4326)::public.geography) / 1000.0)::float8 AS "distanceKm"
FROM "Workshop" w
WHERE w."status" = 'active'
  AND ($type::text IS NULL OR w."workshopType" = $type)
  AND ($radius::float8 IS NULL OR
       public.ST_SetSRID(public.ST_MakePoint(w."lng", w."lat"), 4326)::public.geography
       OPERATOR(public.<->)
       public.ST_SetSRID(public.ST_MakePoint($lng::float8, $lat::float8), 4326)::public.geography
       <= $radius::float8 * 1000)
ORDER BY public.ST_SetSRID(public.ST_MakePoint(w."lng", w."lat"), 4326)::public.geography
         OPERATOR(public.<->)
         public.ST_SetSRID(public.ST_MakePoint($lng::float8, $lat::float8), 4326)::public.geography
LIMIT $limit OFFSET $offset;
```

Catatan implementasi:

- `ORDER BY` hanya berisi operator jarak. Menambah tie-breaker (`w."id"`) memaksa full sort dan planner berhenti memakai `Index Scan using "Workshop_location_gist"` (diverifikasi dengan `EXPLAIN`).
- Nama PostGIS dikualifikasi `public.` dan operator memakai `OPERATOR(public.<->)` karena Prisma menetapkan `search_path` ke schema datasource; suite API berjalan di schema `indobengkel_test`, sehingga nama tanpa kualifikasi tidak resolve.
- `open_now` dihitung di SQL dari `jsonb_array_elements(w."hours")` + `NOT EXISTS` closure, dengan hari/jam Jakarta dikirim sebagai parameter. Filter ini ikut serta dalam query `COUNT(*)` sehingga `meta.total` konsisten dengan halaman.
- `total` diambil dari query `COUNT(*)` terpisah (bukan `COUNT(*) OVER ()`): window function memaksa seluruh hasil diproses sebelum `LIMIT`, sehingga keuntungan KNN hilang.

---

## 6. Autentikasi & Sesi

**Baseline yang berjalan**

| Aspek | Nilai |
|---|---|
| Password | `bcryptjs`, cost 10 |
| Sesi | baris `sessions` (`id`, `userId`, `expiresAt`), token opaque 32 byte; cookie `ib_session` |
| Cookie | `httpOnly`, `SameSite=Lax`, `Path=/`, umur 7 hari; `Secure` mengikuti `COOKIE_SECURE` |
| Guard | `SessionGuard` global membaca cookie → sesi aktif → user; `@Public()` untuk health/login/register/katalog |
| Role | `customer` / `workshop_owner`; endpoint konsol memeriksa `workshop.ownerId` |
| Logout | hapus sesi + clear cookie |
| CSRF | `CsrfGuard` double-submit `ib_csrf` + `X-CSRF-Token` untuk semua mutasi ber-sesi; endpoint bootstrap di-exempt |
| Rate limit | `RateLimitGuard` fixed window: global 1200/menit, login/register 10/menit per IP+email, chat 30/menit, review 10/menit, demo reset 3/menit. Counter di Redis bila `REDIS_URL` diset; fallback in-memory saat Redis tidak tersedia |
| Email verification | endpoint tersedia, tetapi seed sudah `emailVerifiedAt`; belum ada pengiriman email |

**Target produksi:** access JWT 15 menit + refresh opaque 30 hari dengan rotasi dan deteksi reuse, `VerifiedEmailGuard`, `ResourceOwnerGuard`, serta limit lebih ketat (login 5/menit, register 3/jam, review 5/jam, pickup verify 5/menit). Counter rate limit sudah terdistribusi lewat Redis.

---

## 7. API Convention

- Base `/api/v1`; JSON; UTC ISO-8601. FE memanggil same-origin `/api/v1/*`, di-rewrite Next ke `API_INTERNAL_URL`.
- Upload lokal: `POST /api/uploads` + `GET /api/uploads/[name]` (di luar `/api/v1`); target produksi `/api/v1/uploads/presign`.
- Sukses tunggal: `{ "data": { ... } }`; list: `{ "data": [...], "meta": { page, perPage, total } }`. FE hanya mempertahankan envelope untuk `workshops` dan `products`.
- Error: `{ "error": { "code": "...", "message": "...", "details": [...] } }`; pesan BE saat ini berbahasa Inggris dan belum dilokalkan.
- Validasi: `ValidationPipe({ whitelist: true, transform: true })` + DTO eksplisit.
- Pagination: `page` (default 1), `perPage` (default 20, maks 100).
- Idempotency: pembayaran simulasi menolak `paid` ganda; `POST /orders` memakai transaksi + cek stok.
- Swagger belum dipasang.

**Endpoint utama**

| Area | Endpoint |
|---|---|
| Auth | `POST /auth/login`, `/auth/register/customer`, `/auth/register/workshop`, `/auth/logout`; `GET /auth/me`, `/auth/refresh`; `PATCH /me/locale` |
| Katalog | `GET /workshops`, `/workshops/:slug`, `/workshops/:id/availability`, `/products`, `/products/:slug` |
| Kendaraan | `GET/POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id` |
| Booking | `GET/POST /service-orders`, `GET /service-orders/:id`, `POST .../cancel`, `.../approve-estimate`, `.../reject-estimate`, `.../pay` |
| Commerce | `GET/POST /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`, `DELETE /cart`; `GET/POST /orders`, `GET /orders/:id`, `POST .../cancel`, `.../pay`, `.../confirm-delivery` |
| Review | `POST /reviews/product`, `POST /reviews/workshop` |
| Konsol | `GET/PATCH /workshop/me`, `GET /workshop/dashboard`; CRUD `mechanics`, `services`, `products`; `GET /workshop/bookings` + `confirm`/`decline`/`no-show`; `.../service-orders/:id/start`/`complete`/`cash-paid`; `GET /workshop/orders` + `preparing`/`ready`/`ship`/`verify-pickup`; `GET /workshop/reviews` + `:id/reply` |
| Chat | `GET/POST /conversations`, `GET /conversations/:id`, `POST .../messages`, `POST .../read` |
| Notifikasi | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read` |
| Demo | `POST /demo/reset`, `GET /health` |

**Katalog kode error (ringkas; baseline + target)**

| HTTP | Code |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_PICKUP_CODE`, `INVALID_TRANSITION`, `INVALID_BODY`, `MISSING_FILE` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ACCOUNT_SUSPENDED` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `PLATE_TAKEN`, `SLOT_FULL`, `ALREADY_REVIEWED`, `INSUFFICIENT_STOCK`, `PRODUCT_UNAVAILABLE`, `PAYMENT_ALREADY_PAID`, `DUPLICATE_REPLY`, `INVALID_TRANSITION`, `INVALID_FULFILLMENT` |
| 413 | `FILE_TOO_LARGE` |
| 415 | `UNSUPPORTED_TYPE` |
| 422 | `VALIDATION_ERROR`, `VEHICLE_TYPE_MISMATCH`, `WORKSHOP_CLOSED`, `ODOMETER_TOO_LOW`, `WEAK_PASSWORD` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `STORAGE_UNAVAILABLE` |

---

## 8. Alur Domain (Sequence)

**Catatan baseline:** diagram di bawah adalah target dengan PostGIS, advisory lock, webhook, dan cron. Runtime lokal menjalankan transisi yang sama secara sederhana: Prisma transaction, cek status + stok, cookie sesi, pembayaran simulasi, dan refetch. Tidak ada job antrean; expiry order dihitung dari `expiresAt` saat dibaca.

### 8.1 Buat booking → confirm (kapasitas)

```
Customer            API                       DB
   │ POST /service-orders │                    │
   │─────────────────────▶│ validasi role, email, kendaraan, tipe
   │                      │ resolveSlot: jam buka + closure + kelipatan jam
   │                      │ BEGIN
   │                      │ SELECT ... FROM "Workshop" FOR UPDATE
   │                      │ SELECT count(*) status IN (confirmed,in_progress) pada slot
   │                      │  count >= capacity ? → 409 SLOT_FULL (rollback)
   │                      │ INSERT service_orders(status=requested)
   │                      │ COMMIT
   │◀─────────────────────│ 201                │
   │                      │                    │
Owner                │ POST /:id/confirm      │
   │─────────────────────▶│ BEGIN              │
   │                      │ SELECT ... FROM "Workshop" FOR UPDATE
   │                      │ SELECT order (status requested)
   │                      │ SELECT count(*) status IN (confirmed,in_progress) pada slot
   │                      │  count >= capacity ? → 409 SLOT_FULL (rollback)
   │                      │ UPDATE status=confirmed, estimated_total
   │                      │ COMMIT
   │◀─────────────────────│ 200 + notifikasi
```

`resolveSlot` (`src/common/slots.ts`) memakai zona waktu bengkel (`timezone`, default
`Asia/Jakarta`) dan menolak timestamp yang bukan kelipatan jam, hari tutup,
closure, atau di luar jam buka. Lock baris `Workshop` menyerialkan create dan
confirm untuk bengkel yang sama, sehingga dua permintaan bersamaan tidak bisa
mengambil slot terakhir; `requested` tidak memakai kapasitas.

### 8.2 Checkout (stok)

Satu `POST /orders` = satu bengkel. Checkout multi-bengkel memanggil endpoint ini sekali per cart bengkel (N order, N payment); UI mengirim semua setelah customer memilih fulfillment tiap bengkel.

```
POST /orders
BEGIN
  SELECT workshop active
  FOR each item:
    UPDATE products SET stock = stock - qty
      WHERE id = $id AND workshop_id = $ws AND is_active AND stock >= qty
      RETURNING price, discount_type, discount_value
    IF 0 rows → ROLLBACK 409 STOCK_CHANGED (details: item)
  INSERT orders(total, shipping_cost, expires_at = now()+60m, pickup_code)
  INSERT order_items(snapshot)
  INSERT order_shipping(address, courier) bila fulfillment = expedition
  INSERT payments(status=pending)
COMMIT
```

### 8.3 Webhook pembayaran

```
POST /webhooks/midtrans
  verify SHA512(order_id + status_code + gross_amount + serverKey)
  BEGIN
    SELECT payment FOR UPDATE WHERE provider_ref = ...
    IF payment.status = paid → COMMIT, 200 (idempotent)
    IF status_code = 200/201/202 → payment.paid; order.status = paid; queue notifikasi
    IF 407 → payment.failed; order.cancelled; restore stock
    IF 202 expired → payment.expired; order.expired; restore stock
  COMMIT
```

### 8.4 Fulfillment

```
Pickup:
Owner memasukkan kode → POST /workshop/me/orders/:id/verify-pickup
  FOR UPDATE order
  status = ready_for_pickup AND fulfillment = pickup? else 409
  normalize(kode) = pickup_code? else 400 INVALID_PICKUP_CODE
  status = completed; completed_at = now()
  unlock product reviews

Ekspedisi:
Owner POST /workshop/me/orders/:id/ship { tracking_number }
  FOR UPDATE order
  fulfillment = expedition AND status = ready_for_pickup? else 409
  tracking_number.length >= 4? else 400
  status = shipped; shipped_at = now(); queue notifikasi resi

Customer POST /orders/:id/confirm-delivery
  FOR UPDATE order
  customer_id = session user AND status = shipped? else 409
  status = completed; completed_at = now(); notify owner
```

### 8.5 Chat

```
Socket connect (cookie access) → verify JWT + sesi → join user:{id}
POST /conversations/:id/messages (REST, sumber kebenaran)
  authorize participant (customer pemilik thread ATAU owner bengkel thread) → INSERT message → update conversation.last_message_at
  → emit message:new ke room conversation:{id} dan user:{recipient}
  → jika recipient tidak punya socket aktif dan email terakhir > 10 menit → enqueue email
```

---

## 9. Konkurensi & Job

**Baseline:** stok dicek dan dipotong dalam transaksi Prisma; pickup code diverifikasi dengan status order; tidak ada cron expiry/reminder/email. Tabel strategi di bawah adalah target.

| Masalah | Solusi |
|---|---|
| Double booking slot | Advisory lock per `(workshop_id, scheduled_at)` + count dalam transaksi |
| Oversell stok | `UPDATE ... WHERE stock >= qty` + cek affected rows |
| Double payment | Unique `provider_ref`; transisi `paid` hanya dari `pending` |
| Pickup ganda | `SELECT ... FOR UPDATE` + cek status |
| Review ganda | Unique constraint di DB, tangkap `P2002` → 409 |
| Expiry order | Cron 1 menit: `FOR UPDATE SKIP LOCKED`, update expired + restore stok |
| Requested booking menumpuk | Tidak mengunci slot; owner menolak/konfirmasi; tidak ada auto-expire di v1 |
| Email gagal | Outbox dengan retry+backoff |
| Agregat rating | Update dalam transaksi yang sama dengan insert review |

**Cron (in-process, `@nestjs/schedule`)**: `orders:expire` tiap menit, `email:flush` tiap 15 detik, `reminders:daily` 09.00 Asia/Jakarta, `payments:reconcile` tiap 5 menit (opsional, fake provider).

---

## 10. Pembayaran

**Baseline:** `Payment` menyimpan metode (`va|transfer|qris`), status (`pending|paid`), nomor VA, dan `paidAt`; endpoint `POST /orders/:id/pay` atau `/service-orders/:id/pay` menandai lunas (simulasi). Owner bisa menandai service cash lunas. Tidak ada webhook, signature, retry, atau refund. Kontrak provider di bawah adalah target Midtrans.

Interface:

```ts
interface PaymentProvider {
  create(input: {
    reference: string;        // order/service code
    amount: number;
    method: 'va' | 'bank_transfer' | 'qris';
    customer: { name: string; email: string; phone: string };
    expiresInMinutes: number;
  }): Promise<{
    providerRef: string;
    status: 'pending';
    instructions: { type: 'va' | 'qris' | 'manual'; bank?: string; vaNumber?: string; qrString?: string; expiresAt: string };
  }>;
  parseWebhook(headers, body): Promise<{
    providerRef: string; status: 'paid' | 'failed' | 'expired'; paidAt?: string; raw: unknown;
  }>;
}
```

- **FakePaymentProvider**: menghasilkan `providerRef` acak, VA number `8808…`, QR string dummy, expiry 60 menit. Endpoint `POST /dev/payments/:id/simulate-paid` hanya terdaftar bila `PAYMENT_PROVIDER=fake`.
- **MidtransProvider**: Core API `POST /v2/charge`; `bank_transfer` (bca/bni/bri/permata), `echannel` (Mandiri), `qris`. Signature webhook `SHA512(order_id + status_code + gross_amount + serverKey)`. Status dipetakan ke enum internal.
- Satu payment `paid` per order/service; retry membuat payment baru dan menutup yang lama (`expired`).
- Tidak ada refund (v1).

**Catatan sandbox:** kredensial Midtrans hanya dipakai di fase 5; fake provider adalah default compose.

---

## 11. Realtime

**Baseline:** tidak ada WebSocket. FE memuat conversation dan notifikasi lewat REST; pengguna melihat pesan baru saat membuka/refetch thread. Target Socket.IO di bawah belum diimplementasikan.

- Gateway Socket.IO, namespace `/chat`, CORS sama dengan API.
- Auth handshake: cookie `ib_access`; verifikasi JWT + sesi; gagal → `connect_error`.
- Room: `user:{userId}` (notifikasi & inbox), `conversation:{id}` (setelah otorisasi).
- Event klien: `conversation:join`, `conversation:leave`, `message:read`, `typing`.
- Event server: `message:new`, `message:read`, `typing`, `notification:new`.
- Pesan **selalu** disimpan via REST sebelum emit; WS tidak menulis DB langsung.
- Redis saat ini dipakai untuk rate limit, belum untuk Socket.IO; `@socket.io/redis-adapter` tetap menjadi jalur scale-out.

---

## 12. Upload, Email, Notifikasi

**Upload — lokal (berjalan sekarang)**

Endpoint `POST /api/uploads` (route handler Next.js di `src/app/api/uploads/route.ts`), `multipart/form-data` dengan field `file`. File dibaca kembali lewat `GET /api/uploads/[name]` (`src/app/api/uploads/[name]/route.ts`) karena `next start` tidak menyajikan file public yang ditambahkan setelah build.

| Aspek | Nilai |
|---|---|
| Tipe diterima | `image/jpeg`, `image/png`, `image/webp`; selain itu `415 UNSUPPORTED_TYPE` |
| Ukuran | 1 B–5 MB; di luar itu `413 FILE_TOO_LARGE` |
| Nama file | `{waktu base36}-{uuid8}.{ext}` |
| Tujuan | `public/uploads/` (volume Docker `indobengkel-uploads`) |
| Respons | `201 { "url": "/api/uploads/<name>" }`, header `cache-control: no-store` |
| Serving | `GET /api/uploads/[name]` → `image/*`, `cache-control: public, max-age=31536000, immutable`; path traversal ditolak, file hilang → 404 |
| Error | `400 INVALID_BODY` / `MISSING_FILE`, `415`, `413`, `503 STORAGE_UNAVAILABLE` |
| Auth | sesi wajib (`GET /auth/me`); setelah file ditulis, route memanggil `POST /api/v1/uploads` untuk mencatat `{name, mimeType, size}` + `ownerUserId` |
| Kepemilikan | Interceptor global memindai body mutasi; URL `/api/uploads/...` yang bukan milik pemanggil → `403 UPLOAD_NOT_OWNED` |

**Pipeline klien** (`src/lib/upload-image.ts`) — dipakai semua field foto:

1. Validasi tipe dan ukuran sumber (≤12 MB).
2. `FileReader` → data URL; progres 4–18% (`Reading`).
3. Decode → canvas; sisi terpanjang maksimum 1280 px, latar putih.
4. Encode JPEG kualitas 0.86; turun 0.08 hingga ≤340 KB (batas bawah 0.5) (`Optimising` 22–36%).
5. `XMLHttpRequest` `POST /api/uploads` dengan `FormData`; progres unggah nyata 42–92% (`Uploading`).
6. Selesai 100% (`Finishing`/`Uploaded`); durasi minimum 720 ms agar tahap terbaca, bukan kilat.
7. Jika endpoint gagal (jaringan, 5xx, atau storage read-only `503`), hasil kompresi dibaca sebagai **data URL** (`Finalizing` 94%) sehingga demo tetap selesai tanpa storage.

**UI** (`src/components/ui/image-upload.tsx`):
- `ImageUpload` untuk satu foto (`photo`, `banner`, `avatar`), `MultiImageUpload` untuk galeri, `UploadProgressBar` untuk progres bertahap.
- Input: drag & drop, file picker (`IMAGE_ACCEPT`), dan camera sheet — `getUserMedia` dengan `facingMode` `environment`/`user`, tombol ganti kamera, capture frame JPEG 0.92, fallback ke file picker bila izin ditolak.
- Pratinjau lokal instan; nilai lama tidak berubah sampai unggah sukses; ganti menimpa, hapus mengosongkan; counter `n of max` pada galeri.

**Cakupan field**

| Field | Komponen | Maks |
|---|---|---|
| Cover bengkel | `ImageUpload` (banner) | 1 |
| Galeri bengkel | `MultiImageUpload` | 6 |
| Foto montir | `ImageUpload` (avatar) | 1 |
| Foto produk | `ImageUpload` | 1 |
| Foto kendaraan | `ImageUpload` | 1 |
| Foto pekerjaan service | `MultiImageUpload` | 4 |
| Lampiran chat | `uploadImage` + `UploadProgressBar` | 1 per pesan |

**Upload — produksi (target)**
- `POST /uploads/presign` → validasi `folder` (`workshop|product|service|avatar|chat`), `contentType` (jpg/png/webp), `size` ≤5 MB (objek sudah dikompresi klien) → key `folder/{ownerId}/{uuid}.{ext}` → presigned PUT 5 menit, `Content-Type` dikunci.
- Bucket MinIO `indobengkel` dengan policy read publik; produksi memakai S3/R2 + CloudFront.
- BE menyimpan URL relatif; FE menampilkan via `next/image` dengan `remotePatterns`.
- Verifikasi pasca-upload: `HEAD` object (ukuran, content-type) sebelum URL dipakai di entitas.
- UI tidak berubah: ganti pemanggilan `postFile` dengan presigned PUT (XHR tetap memberi progres), lalu simpan URL relatif.

**Email**

**Baseline:** belum ada pengiriman email; endpoint verifikasi/reset tersedia tetapi token tidak dikirim. Bagian di bawah adalah target produksi.
- Adapter `Mailer`: `MailpitMailer` (SMTP), `ResendMailer` (HTTP).
- Tabel `email_outbox`: `id, user_id, template, locale, payload jsonb, status (pending|sent|failed), attempts, next_attempt_at, sent_at`.
- Worker `email:flush`: ambil 20 baris `FOR UPDATE SKIP LOCKED`, render template, kirim, retry maks 5 dengan backoff 1m/5m/15m/1h.
- Template: fungsi TS yang mengembalikan HTML (layout bersama, teks EN/ID), bukan React Email, agar build BE ringan.
- Notifikasi in-app ditulis langsung ke `notifications`; email di-enqueue sesuai matriks FSD.

---

## 13. i18n

- FE: `next-intl`, route `/[locale]`, `messages/en.json`, `messages/id.json`; `localePrefix: 'always'`; default `en`, deteksi cookie → `Accept-Language` → `en`. Namespace `uploads.*` mencakup label tombol, tahap progres, pesan error, dan kamera; key EN/ID dijaga parity.
- BE: dictionary `src/i18n/{en,id}.ts` untuk pesan error, email, dan notifikasi; locale diambil dari `users.locale`, fallback `Accept-Language`.
- Format: uang `Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 })` di kedua locale; tanggal `Intl.DateTimeFormat(locale)`; jarak km/m.
- Tidak ada penerjemahan konten user.

---

## 14. Keamanan

**Baseline yang berjalan:** sesi httpOnly + query kepemilikan di service (IDOR), DTO eksplisit, React escaping, CSRF double-submit, rate limit fixed window dengan counter Redis (fallback memory), Helmet/CORS allowlist, upload wajib sesi + allowlist MIME + 5 MB + magic bytes + nama acak + kepemilikan file di tabel `Upload`, `SameSite=Lax`. **Belum berjalan:** rotasi access/refresh JWT, verifikasi email wajib, pino redaction. Tabel di bawah adalah target kontrol; baris yang bertanda ✅ sudah aktif di baseline.

| Risiko | Kontrol target |
|---|---|
| IDOR | Setiap query menyertakan `owner_user_id`/`customer_id`/`workshop_id`; test khusus per endpoint |
| XSS | React escaping; tidak ada `dangerouslySetInnerHTML` untuk konten user; sanitasi deskripsi→plain text |
| CSRF | ✅ SameSite=Lax + double-submit `ib_csrf`/`X-CSRF-Token` untuk mutasi ber-sesi |
| Brute force | ✅ Fixed window per IP (+email) dengan counter Redis + pesan login generik; fallback in-memory saat Redis down |
| Session theft | httpOnly, Secure, rotation + reuse detection, revoke-all |
| Upload abuse | ✅ Lokal: sesi valid + allowlist MIME + 5 MB + magic bytes + nama acak; produksi: presigned dengan content-type & size, auth, validasi HEAD |
| Mass assignment | ValidationPipe whitelist + DTO eksplisit |
| SQL injection | Prisma + parameterized `$queryRaw`; tidak ada string interpolation |
| Webhook spoof | Verifikasi signature Midtrans; endpoint rate-limited |
| Enumeration | 404 untuk resource yang bukan miliknya, bukan 403 |
| PII di log | pino redact: authorization, cookie, password, token, phone, email |
| Header | ✅ Helmet, CORS whitelist `APP_URL` + `X-CSRF-Token`, CORP cross-origin |

**Checklist uji keamanan fase 7:** akses lintas bengkel, akses service order orang lain, pickup code brute force, resi/confirm-delivery milik orang lain, akses laporan bengkel lain, review ganda, upload file palsu, webhook tanpa signature, refresh reuse.

---

## 15. Observability

**Baseline:** Nest default logger + `GET /api/v1/health` yang mengecek koneksi DB (`{ status, service, database, timestamp }`); error filter mengembalikan envelope + stack hanya di log server. Belum ada requestId, pino, `/health/ready`, atau Sentry.

**Target:** pino JSON + requestId, log method/path/status/durasi/userId tanpa PII, liveness/readiness terpisah, Sentry opsional.

---

## 16. Testing

| Level | Baseline yang sudah dijalankan | Target (belum) |
|---|---|---|
| Static | `tsc --noEmit` (BE + FE), `nest build`, `next build` | ESLint di CI |
| API smoke | health, login, `/auth/me`, katalog, dashboard, booking/order/chat/notification, upload | — |
| E2E manual | Login owner/customer, semua halaman konsol + customer, cart → checkout → simulasi bayar, booking → owner confirm/start/complete/cash-paid, order preparing/ready/pickup, review reply, chat kirim, upload file + camera | — (Playwright otomatis sudah di CI) |
| Unit/Integration | Jest + Supertest + skema terisolasi `indobengkel_test`; 50 test default, 51 saat `REDIS_URL` diset | Tambah cakupan modul lain |
| Database | `prisma migrate deploy` + seed snapshot (reset tabel); test schema memakai `db push`; CI cek drift | Seed test terpisah |

- Smoke API dijalankan terhadap stack Docker; upload diverifikasi dengan file 1200×800 dan URL `/api/uploads/...` tetap tampil setelah reload.
- Target produksi tetap 70% coverage modul domain + 6 alur Playwright.

---

## 17. Docker & Environment

**Compose services yang berjalan:** `db` (`postgres:16-alpine`), `redis` (`redis:7-alpine`), `backend` (NestJS), `frontend` (Next.js `next start`). Volume `indobengkel-uploads` dipasang di `/app/public/uploads`. DB memetakan host **55432** (port 5432 dipakai PostgreSQL native di mesin pengembang); Redis memetakan **127.0.0.1:6379**. Backend 4000, frontend 3000.

Healthcheck: `pg_isready` untuk DB, `redis-cli ping` untuk Redis; `wget http://127.0.0.1:4000/api/v1/health` untuk backend; frontend menunggu backend `healthy`. Backend start menjalankan `prisma migrate deploy`, seed snapshot (mengosongkan tabel demo), lalu `node dist/src/main.js`. Redis tidak dipersistensikan (`--save "" --appendonly no`, maxmemory 64 MB, `allkeys-lru`) karena hanya menyimpan counter sementara.

**Env (BE)**

```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://indobengkel:indobengkel@db:5432/indobengkel
REDIS_URL=redis://redis:6379/0
COOKIE_SECURE=false
CSRF_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_GLOBAL=1200
```

**Env (FE)**

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_USE_MOCK_API=false
API_INTERNAL_URL=http://backend:4000
```

Build arg FE: `NEXT_PUBLIC_USE_MOCK_API`, `API_INTERNAL_URL`, `NEXT_PUBLIC_APP_URL`. Upload lokal memakai volume; target produksi memakai `S3_*`/MinIO.

**Perintah:**

```
docker compose up -d --build      # db + redis + backend + frontend
docker compose logs -f backend
docker compose down               # data DB tetap di volume
docker compose down -v            # reset DB + upload
```

**Tanpa Docker:** `docker compose up -d db redis`, lalu di `IndoBengkelBE`: `npm run db:migrate && npm run build && npm run db:seed && npm run start:dev` dengan `REDIS_URL=redis://localhost:6379/0` (opsional); di `IndoBengkelFE`: `npm run dev` dengan `API_INTERNAL_URL=http://localhost:4000`.

---

## 18. CI

**Baseline:** `.github/workflows/ci.yml` menjalankan tiga job: backend (Postgres 16 + Redis 7, `migrate deploy`, drift check, typecheck, build, 51 test API), frontend (typecheck + `next build`), dan e2e (Docker Compose + Playwright, artefak + log saat gagal).

**Target berikutnya:** gate coverage, performance test, dan deploy otomatis setelah merge.

---

## 19. Performa

| Target | Angka |
|---|---|
| Search p95 | < 300 ms (10k bengkel) |
| List produk p95 | < 200 ms |
| Checkout p95 | < 400 ms |
| Chat delivery | < 300 ms |
| FE TTI 4G | < 2.5 s (halaman list) |
| Bundle awal | < 250 KB gzip per route utama |

Teknik yang berjalan: pagination, `select` terbatas, TanStack Query, kompresi klien (≤340 KB, sisi terpanjang 1280 px), route upload + cache immutable, GiST geo index untuk KNN. Index trgm, lazy map, RSC data awal, dan target latency di atas masih target produksi.

**Baseline terukur:** health API < 50 ms lokal; list 23 bengkel + 115 produk termuat < 500 ms setelah backend hangat; bundle awal 103–193 KB per route (Next build).

---

## 20. Risiko Teknis & Keputusan

| Risiko | Keputusan |
|---|---|
| Prisma tidak mendukung PostGIS native | Index GiST ekspresi + raw query terisolasi di `WorkshopGeoRepository`; kolom `Unsupported` dihindari agar `migrate diff` tetap bersih |
| Socket.IO single instance | Redis dipakai untuk rate limit, belum untuk Socket.IO; `@socket.io/redis-adapter` menjadi jalur scale-out |
| Email inline memperlambat request | Outbox + worker cron |
| Cron in-process ganda saat scale | v1 single instance; produksi butuh leader lock/worker terpisah |
| OSM tile policy | Adapter `NEXT_PUBLIC_MAP_TILE_URL`; siap ganti |
| Midtrans Core API per metode | Adapter menormalkan instruksi; fake provider meniru bentuk yang sama |
| Slug bentrok | `name-city` + suffix acak 4 karakter |
| Zona waktu | `luxon`; semua perhitungan slot memakai `workshops.timezone` |
| Tanpa refund | Tidak ada endpoint; kegagalan fulfillment ditangani manual (di luar aplikasi) |
| Presigned upload tanpa virus scan | Diterima v1 (gambar), batasi mime + ukuran |
| Upload lokal tanpa auth | Diterima hanya untuk runtime lokal; produksi wajib guard + presign dan endpoint tidak diekspos publik |
| Filesystem upload read-only | Klien fallback ke data URL; produksi memakai object storage |
| Mode mock di `localStorage` | Hanya fallback demo FE; runtime utama memakai PostgreSQL |
| MIME spoof | Lokal memercayai `file.type`; produksi memvalidasi magic bytes + `HEAD` objek |

---

## 21. Definisi "Siap Demo"

- `docker compose up --build` bersih → DB siap → seed → FE + API sehat tanpa langkah manual.
- Simulasi pembayaran menyelesaikan alur tanpa key eksternal.
- Semua endpoint utama teruji smoke; error envelope konsisten.
- Alur customer dan owner bisa dilalui di browser tanpa error konsol.
- Semua field foto menerima file atau kamera, menampilkan progres bertahap, dan URL `/api/uploads/...` bertahan setelah reload.
- Home rapi tanpa horizontal scroll pada 360–1440 px di Night Shift maupun Day Shift.
- Skeleton muncul saat data dimuat; tidak ada layar kosong.

**Belum termasuk definisi demo:** email Mailpit, Swagger, Playwright otomatis, Socket.IO, Midtrans, dan object storage.
