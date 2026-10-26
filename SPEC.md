# IndoBengkel — Spesifikasi Final v1.0

Status: **menunggu persetujuan**. Belum ada kode yang ditulis.
Tanggal: 2026-10-21

---

## 1. Ringkasan Produk

IndoBengkel adalah aplikasi web bengkel online dengan dua role pengguna: **Customer** dan **Workshop Owner**. Tidak ada role admin platform. Customer dapat mendaftarkan kendaraan, mencari bengkel terdekat, memesan service, berbelanja produk lewat **BengkelShop** (cart lintas bengkel, pickup atau kirim ekspedisi per bengkel), dan chat dengan bengkel. Workshop Owner juga dapat memakai semua fitur customer untuk kebutuhan pribadinya, sekaligus mengelola profil, montir, katalog layanan ber-item, produk, booking/service order, order toko, rating, chat, dan laporan bengkelnya sendiri.

**Batasan v1 (keputusan sadar):**

| Area | Keputusan |
|---|---|
| Tahap | MVP demo, arsitektur siap produksi |
| Mata uang | IDR saja, semua nilai uang integer rupiah (tanpa desimal) |
| Geografi | Operasional Indonesia; koordinat & country_code global agar bisa ekspansi |
| Pengiriman | **Pickup di bengkel (gratis)** atau **ekspedisi** (JNE/J&T/SiCepat/AnterAja, ongkir berbasis berat, resi manual) |
| Pembayaran | Midtrans (VA, transfer bank, QRIS) + cash untuk service; **fake provider** untuk lokal |
| Refund | **Tidak ada** di v1 (lihat §12 Risiko) |
| Ledger/payout | Tidak ada UI; rekap via script CSV |
| Verifikasi bengkel | Tanpa approval admin; bengkel tayang setelah email terverifikasi + profil lengkap |
| Peran | Customer + Workshop Owner; **tidak ada admin platform** |
| Bahasa | EN (default) + ID; konten buatan user tidak diterjemahkan |
| Desain | "Night Shift" — dark, lime accent |
| Montir | Data saja, tidak punya akun login |
| Chat | Thread per pasangan customer ↔ bengkel; AI menyusul fase 2 |

---

## 2. Keputusan yang Sudah Dikunci

1. Satu akun = satu bengkel, satu lokasi; konsol hanya melihat data bengkel itu.
2. Jenis bengkel **eksklusif**: `motor` atau `mobil`.
3. Kendaraan milik customer; riwayat service hanya lahir dari service order yang dikonfirmasi bengkel.
4. Odometer hanya berubah lewat service order (input customer saat booking, dikonfirmasi bengkel saat start).
5. Cart dapat menampung produk dari beberapa bengkel sekaligus; checkout memilih pickup/GoSend/ekspedisi **per bengkel**.
6. Satu order hanya berisi item dari satu bengkel. Dua bengkel = dua order & dua pembayaran, dibuat dari satu sesi checkout.
7. Pickup code diverifikasi petugas di layar; order ekspedisi memakai nomor resi + konfirmasi diterima customer. GoSend termasuk ekspedisi (kurir instan, resi/booking ID tetap diisi bengkel).
8. Service: estimasi saat konfirmasi; invoice final >150% estimasi wajib approval customer.
9. Service dibayar online setelah selesai, atau cash yang dicatat petugas.
10. Tidak ada admin; laporan bengkel dibatasi ke bengkel sendiri.
11. Rating bengkel dari service order selesai; rating produk dari order selesai (pickup atau ekspedisi).
12. Review tidak bisa dihapus/diedit; tidak ada moderasi global.
13. Notifikasi in-app + email; WhatsApp ditunda.
14. Peta Leaflet + OSM tiles + Photon/Nominatim, di belakang adapter.
15. Tidak ada refund di v1.

---

## 3. Arsitektur & Stack

```
IndoBengkel/
├─ docker-compose.yml
├─ .env.example
├─ SPEC.md
├─ IndoBengkelBE/        NestJS 11 + Prisma + Socket.IO
├─ IndoBengkelFE/        Next.js 15 App Router + TS + Tailwind + shadcn/ui
└─ IndoBengkelDB/        init SQL (PostGIS, pg_trgm), seed, aset dummy, ERD
```

**Services di docker-compose:**

| Service | Image | Port | Catatan |
|---|---|---|---|
| db | postgis/postgis:16-3.4 | 5432 | volume `pgdata` |
| be | build `IndoBengkelBE` | 3001 | hot reload di dev |
| fe | build `IndoBengkelFE` | 3000 | proxy `/api` → be |
| minio | minio/minio | 9000/9001 | bucket `indobengkel` |
| minio-init | minio/mc | – | buat bucket + policy publik baca |
| mailpit | axllent/mailpit | 8025 | SMTP 1025 |

Tanpa Redis di v1 (Socket.IO single instance). Adapter Redis disiapkan sebagai catatan, bukan implementasi.

**Auth transport:** access token (15 menit) dan refresh token (30 hari) di **httpOnly cookie**, `SameSite=Lax`, `Secure` di produksi. Mutasi state memakai header `X-CSRF-Token` (double-submit). FE mengakses API lewat rewrite `/api/*` agar cookie same-origin.

**ORM:** Prisma. Kolom geografi memakai `Unsupported("geography(Point,4326)")` dan query nearest via `$queryRaw` (`<->` KNN + `ST_DWithin`).

**API docs:** Swagger di `/docs` (non-produksi) — dipakai juga untuk koleksi Postman.

---

## 4. Role & Permission

| Aksi | Customer | Workshop Owner |
|---|---|---|
| Registrasi & login | ✅ | ✅ |
| Kelola kendaraan sendiri | ✅ | ✅ (sebagai customer) |
| Lihat bengkel & produk | ✅ | ✅ (bengkelnya) |
| Booking service | ✅ | ✅ (sebagai customer) |
| Konfirmasi/start/finish service | – | ✅ (bengkelnya) |
| Kelola montir/layanan/produk | – | ✅ (bengkelnya) |
| Checkout & bayar (pickup/ekspedisi) | ✅ | ✅ (sebagai customer) |
| Verifikasi pickup / input resi | – | ✅ (bengkelnya) |
| Konfirmasi terima barang ekspedisi | ✅ | ✅ (sebagai customer) |
| Chat | ✅ (ke bengkel mana pun) | ✅ (sebagai customer) + ✅ melayani customer bengkelnya |
| Review | ✅ (order selesai) | ✅ (sebagai customer) + balas sekali |
| Laporan bengkel | – | ✅ (bengkelnya) |
| Lihat order | miliknya | miliknya + order bengkelnya di konsol |

**Aturan akun:** satu email = satu role. Customer dan bengkel tidak bisa berbagi email. Akun suspended tidak bisa login; token yang ada dicabut. Workshop owner memakai halaman customer yang sama untuk kebutuhan pribadinya (kendaraan, booking, belanja, chat, review) tanpa mengubah akses konsol. Tidak ada endpoint/halaman lintas-bengkel di konsol.

---

## 5. Skema Database

Semua `id` = UUID v4. Semua tabel punya `created_at`/`updated_at` (timestamptz). Semua waktu disimpan **UTC**; ditampilkan memakai timezone bengkel / timezone browser.

### 5.1 Enums

```
user_role            customer | workshop_owner
user_status          active | suspended
workshop_type        motor | mobil
workshop_status      draft | active | suspended
vehicle_type         motor | mobil
service_order_status requested | confirmed | declined | cancelled | no_show |
                     in_progress | awaiting_approval | completed | paid
order_status         pending_payment | paid | preparing | ready_for_pickup |
                     shipped | completed | cancelled | expired
fulfillment_method   pickup | expedition
payment_method       va | bank_transfer | qris | cash
payment_status       pending | paid | failed | expired
payment_provider     fake | midtrans
order_item_kind      product
service_item_kind    labor | part
discount_type        none | percent | fixed
review_status        published | hidden
report_status        open | resolved | dismissed
report_target        review | message
```

### 5.2 Tabel

**users**
`id, email (citext, unique), password_hash (argon2id), role, status, full_name, phone, locale (en|id, default en), email_verified_at, avatar_url, last_login_at`

**sessions**
`id, user_id → users, refresh_token_hash (unique), user_agent, ip, expires_at, revoked_at, replaced_by_session_id, last_used_at`
Index: `(user_id, revoked_at)`.

**auth_tokens**
`id, user_id, kind (verify_email|reset_password), token_hash (unique), expires_at, used_at`

**workshops**
`id, owner_user_id → users (unique), name, slug (unique), description, workshop_type, phone, address_line, city, province, postal_code, country_code (default ID), location geography(Point,4326), timezone (default Asia/Jakarta), cover_url, logo_url, slot_capacity_per_hour (default 1), status, rating_avg numeric(3,2) default 0, rating_count int default 0, published_at`
Index: GIST `location`; `pg_trgm` GIN pada `name`, `address_line`.

**workshop_photos** `id, workshop_id, url, sort_order`
**workshop_hours** `id, workshop_id, day_of_week (0=Sun..6=Sat), open_time, close_time, is_closed` — unique `(workshop_id, day_of_week)`
**workshop_closures** `id, workshop_id, date, reason` — unique `(workshop_id, date)`

**mechanics**
`id, workshop_id, name, phone, experience_years, skills text[] (boleh berisi "general"), photo_url, is_active`
Catatan: `skills` diisi dari daftar tetap di UI (general, engine, electrical, body, tire, AC, transmission) + free text tidak diizinkan di v1.

**services** (katalog layanan bengkel)
`id, workshop_id, name, description, price int, duration_minutes, is_active`

**vehicles**
`id, customer_id → users, type, brand, model, year, plate_number, color, odometer_km, photo_url, reminder_months (default 6), reminder_km (default 5000), last_service_at`
Unique `(customer_id, plate_number)`. `odometer_km` hanya ditulis oleh service order (kecuali saat create).

**service_orders**
`id, code (unique, mis. SO-8F3K2), customer_id, workshop_id, vehicle_id, status, scheduled_at, complaint, customer_note, odometer_in, odometer_out, estimated_total int, final_total int, approved_total_at, started_at, completed_at, paid_at, payment_method, cash_recorded_by, cancel_reason, cancelled_by (customer|workshop|system), cancelled_at, no_show_at, mechanic_note`
Relasi: `service_order_mechanics (service_order_id, mechanic_id)` unique pasangan.
`service_order_items` `id, service_order_id, kind, product_id (nullable), name, qty, unit_price, subtotal`
`service_order_photos` `id, service_order_id, url, label (before|after|document)`
`service_order_events` `id, service_order_id, from_status, to_status, actor_user_id, note` — audit trail.
Index: `(workshop_id, scheduled_at)`, `(customer_id, created_at)`.

**products**
`id, workshop_id, title, slug, description, category (sparepart|oil|accessories|tools|other), brand, part_number, price int, discount_type, discount_value, weight_grams, stock, is_active, rating_avg, rating_count`
`final_price` dihitung: `percent → round(price*(1-value/100))`, `fixed → max(0, price-value)`.
**product_images** `id, product_id, url, sort_order`
Index: `(workshop_id, is_active)`, GIN trigram pada `title`.

**carts** `id, customer_id, workshop_id, updated_at` — unique `(customer_id, workshop_id)`
**cart_items** `id, cart_id, product_id, qty` — unique `(cart_id, product_id)`

**orders**
`id, code (unique, mis. ORD-7K2M9), customer_id, workshop_id, status, fulfillment (pickup|expedition), subtotal, discount_total, shipping_cost, total, pickup_code (6 char), customer_phone, expires_at, paid_at, preparing_at, ready_at, shipped_at, completed_at, cancelled_at, cancel_reason`
**order_shipping** `order_id, courier, service, cost, recipient, phone, address_line, city, postal_code, tracking_number, shipped_at`
**order_items** `id, order_id, product_id, title_snapshot, unit_price, qty, subtotal, weight_grams`
Unique partial: `pickup_code` unik hanya untuk order berstatus aktif. `order_shipping` wajib bila `fulfillment = expedition`; `tracking_number` wajib sebelum `shipped`.

**payments**
`id, order_id (nullable), service_order_id (nullable), provider, method, amount, status, provider_ref (unique), va_number, qr_string, expires_at, paid_at, raw_payload jsonb`
Constraint: tepat satu dari `order_id` / `service_order_id` terisi; satu pembayaran `paid` per order/service.

**reviews**
`id, customer_id, workshop_id, service_order_id (nullable), order_id (nullable), product_id (nullable), rating (1..5), comment, tags text[], status, workshop_reply, replied_at`
Constraint: tepat satu target — (`service_order_id`) **atau** (`order_id` + `product_id`).
Unique: `(service_order_id)`; `(order_id, product_id)`.
Aturan: review bengkel hanya jika service order `paid`; review produk hanya jika order `completed`; komentar 10–500 karakter.

**conversations** `id, customer_id, workshop_id, last_message_at` — unique `(customer_id, workshop_id)`
**messages** `id, conversation_id, sender_user_id, body (≤2000), attachment_url, read_at, deleted_at, deleted_by`
Index: `(conversation_id, created_at)`.

**notifications** `id, user_id, type, data jsonb, read_at`
Tipe: `booking_requested, booking_confirmed, booking_declined, service_started, estimate_approval, service_completed, service_paid, order_paid, order_ready, order_completed, chat_message, review_reply, service_reminder, workshop_suspended`.

**reminder_logs** `id, vehicle_id, kind (date|km), sent_at` — mencegah reminder berulang.

**reports** `id, reporter_user_id, target_type, target_id, reason, status, resolved_by, resolved_at`

---

## 6. State Machine

### 6.1 Service order

```
requested ──confirm──▶ confirmed ──start──▶ in_progress ──finish──▶ completed ──pay──▶ paid
    │                      │                    │                        │
    │ decline              │ cancel             │ invoice >150%          │ (review terbuka)
    ▼                      ▼                    ▼                        │
 declined              cancelled          awaiting_approval ──approve──▶ completed
                                               │
                                               └──reject──▶ in_progress (item direvisi)
requested/confirmed ──customer cancel (<2 jam)──▶ cancelled
confirmed ──30 menit lewat slot──▶ no_show
```

Aturan:
- `confirm` wajib mengisi `estimated_total` dan slot masih tersedia (kapasitas per jam).
- `start` wajib mengisi `odometer_in` dan minimal satu montir.
- `finish` mengisi item, foto, `final_total`, `mechanic_note`.
- `final_total > 1.5 × estimated_total` → `awaiting_approval`; customer approve → `completed`; reject → kembali `in_progress`.
- `completed` + pembayaran online sukses atau cash dicatat → `paid` → review terbuka.
- Hanya `completed`/`paid` yang menulis `vehicles.odometer_km` (= `odometer_out`) dan `last_service_at`.

### 6.2 Order produk

```
pending_payment ──paid──▶ preparing ──ready──▶ ready_for_pickup ──verify code──▶ completed
       │
       ├──60 menit tanpa bayar──▶ expired
       └──customer cancel──▶ cancelled
```

- Stok dipotong **saat order dibuat**; dikembalikan saat `expired`/`cancelled`.
- Setelah `paid`, customer **tidak bisa** membatalkan (tidak ada refund).
- Pickup code 6 karakter, diverifikasi petugas di layar; status → `completed`.

### 6.3 Payment

```
pending ──webhook paid──▶ paid
pending ──expiry──▶ expired
pending ──failure──▶ failed
```
Webhook Midtrans idempotent berdasarkan `provider_ref` + status; signature diverifikasi. Fake provider punya endpoint `POST /dev/payments/:id/simulate-paid` (hanya aktif jika `PAYMENT_PROVIDER=fake`).

---

## 7. Aturan Bisnis

**Pencarian bengkel**
- Input: `lat`, `lng` (dari geolocation atau hasil pencarian manual), radius (default 10 km, maks 100 km), `type` (motor/mobil), `open_now`, `min_rating`, `q`, sort (`nearest|rating|name`).
- Hasil: jarak (meter → km), rating, jumlah review, status buka/tutup (dihitung dari jam buka + closure + timezone bengkel), cover image, jenis.
- Bengkel `draft`/`suspended` tidak muncul. Bengkel tanpa cover tidak muncul di daftar sampai profil lengkap.
- Hanya bengkel bertipe sama dengan kendaraan yang bisa di-booking.

**Slot booking**
- Slot per 60 menit dari jam buka; jumlah booking aktif per slot ≤ `slot_capacity_per_hour`.
- Booking minimal 1 jam ke depan; maksimal 30 hari ke depan.
- Booking hanya untuk jam buka, bukan closure, dan bukan tanggal lampau (timezone bengkel).

**Pembatalan**
- Customer: bebas sampai 2 jam sebelum slot; lewat itu harus persetujuan bengkel (bengkel approve → `cancelled`).
- Bengkel: boleh menolak/membatalkan dengan alasan wajib.
- No-show ditandai petugas setelah 30 menit; tanpa penalti, tercatat di riwayat.

**Chat**
- Customer boleh memulai chat ke bengkel mana pun.
- Bengkel hanya boleh memulai chat ke customer yang punya booking/order dengan bengkelnya.
- Body ≤2000 karakter; 1 attachment gambar per pesan (≤5 MB).
- User tidak bisa menghapus pesan; tidak ada soft-delete admin.

**Review**
- 1 review bengkel per service order `paid`; 1 review produk per item per order `completed`.
- Rating 1–5, komentar 10–500 karakter, tag opsional (fair_price, fast, honest, clean, friendly).
- Bengkel boleh membalas sekali; balasan publik.
- Agregat `rating_avg`/`rating_count` diperbarui dalam transaksi yang sama.
- Review `hidden` tidak dihitung di agregat.

**Notifikasi email** (EN/ID mengikuti `users.locale`): verifikasi email, reset password, booking requested/confirmed/declined, service completed, order paid/ready, balasan review, reminder service. Reminder berjalan harian; satu reminder per kendaraan per siklus (dicek dari `reminder_logs`).

**Upload**
- Presigned PUT ke MinIO/S3; konten divalidasi di BE (mime, ukuran).
- Batas: gambar ≤5 MB, format jpg/png/webp; maks 6 foto per bengkel/produk, 6 per service order.

**Tanpa refund (konsekuensi)**
- Order `paid` tidak dapat dibatalkan customer.
- Jika bengkel tidak bisa memenuhi order `paid`, owner membatalkan lewat dukungan operasional (script CLI, bukan UI) dan penyelesaian uang dilakukan manual di luar sistem. Ini didokumentasikan sebagai prosedur darurat.

---

## 8. API

Base: `/api/v1`. Semua response JSON; error `{ error: { code, message, details? } }`. Pagination `?page=1&perPage=20` (maks 100).

### Auth
```
POST   /auth/register/customer     { email, password, full_name, phone }
POST   /auth/register/workshop     { email, password, owner_name, phone, workshop:{...} }
POST   /auth/login                 { email, password } → set cookies
POST   /auth/refresh               → rotate refresh
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
POST   /auth/verify-email          { token }
POST   /auth/resend-verification
POST   /auth/forgot-password
POST   /auth/reset-password        { token, password }
PATCH  /auth/locale                { locale }
```

### Customer
```
GET    /me/vehicles
POST   /me/vehicles
GET    /me/vehicles/:id            (termasuk riwayat service)
PATCH  /me/vehicles/:id
DELETE /me/vehicles/:id            (hanya jika belum punya service order)
GET    /me/notifications
POST   /me/notifications/read-all
POST   /me/notifications/:id/read
GET    /workshops?lat&lng&radius&type&open_now&min_rating&q&sort&page
GET    /workshops/:slug
GET    /workshops/:id/availability?date
GET    /workshops/:id/services
GET    /workshops/:id/products
GET    /workshops/:id/reviews
POST   /service-orders
GET    /me/service-orders
GET    /service-orders/:id
POST   /service-orders/:id/cancel
POST   /service-orders/:id/approve-estimate
GET    /me/cart                       (semua cart customer, dikelompokkan per bengkel)
POST   /me/cart/items              { workshopId, productId, qty }
PATCH  /me/cart/items/:id          { qty }
DELETE /me/cart/items/:id
DELETE /me/cart?workshopId
POST   /orders                     { workshopId, paymentMethod }
GET    /me/orders
GET    /orders/:id
POST   /orders/:id/payment         (retry / buat ulang instruksi)
POST   /orders/:id/cancel          (hanya pending_payment)
POST   /service-orders/:id/review
POST   /orders/:id/reviews         { productId, rating, comment, tags }
```

### Workshop
```
GET    /workshop/me
PATCH  /workshop/me
PUT    /workshop/me/hours
POST   /workshop/me/closures
DELETE /workshop/me/closures/:id
POST   /workshop/me/photos
DELETE /workshop/me/photos/:id
GET    /workshop/me/mechanics
POST   /workshop/me/mechanics
PATCH  /workshop/me/mechanics/:id
DELETE /workshop/me/mechanics/:id
GET    /workshop/me/services
POST   /workshop/me/services
PATCH  /workshop/me/services/:id
DELETE /workshop/me/services/:id
GET    /workshop/me/products
POST   /workshop/me/products
PATCH  /workshop/me/products/:id
DELETE /workshop/me/products/:id
GET    /workshop/me/service-orders?status&date
POST   /workshop/me/service-orders/:id/confirm    { estimated_total, scheduled_at? }
POST   /workshop/me/service-orders/:id/decline    { reason }
POST   /workshop/me/service-orders/:id/start      { odometer_in, mechanicIds[] }
PATCH  /workshop/me/service-orders/:id/items
POST   /workshop/me/service-orders/:id/complete   { items[], photos[], mechanic_note, final_total }
POST   /workshop/me/service-orders/:id/mark-cash-paid
POST   /workshop/me/service-orders/:id/no-show
GET    /workshop/me/orders?status
POST   /workshop/me/orders/:id/preparing
POST   /workshop/me/orders/:id/ready
POST   /workshop/me/orders/:id/verify-pickup      { pickupCode }
GET    /workshop/me/reviews
POST   /workshop/me/reviews/:id/reply             { body }
GET    /workshop/me/dashboard
GET    /workshop/me/customers/:id                 (hanya yang bertransaksi)
```

### Chat (REST + WebSocket)
```
GET    /conversations?scope=customer|workshop   (customer: miliknya; workshop: bengkelnya)
POST   /conversations             { workshopId } (customer) / { customerId } (workshop)
GET    /conversations/:id/messages?cursor
POST   /conversations/:id/messages { body, attachmentUrl? }
POST   /conversations/:id/read
WS     namespace /chat            events: message:new, message:read, typing
```

### Laporan (workshop)
```
GET    /workshop/reports?days=7|30|90
       → { serviceRevenue, shopRevenue, totalRevenue, paidCount,
           topServices[], topProducts[], ratingSummary{avg,count,distribution}, transactions[] }
```

### Upload & webhook
```
POST   /uploads/presign           { folder, contentType, size }
POST   /webhooks/midtrans
```

---

## 9. Halaman (FE)

**Customer — mobile-first**

| Route | Isi |
|---|---|
| `/` | Hero, pencarian cepat, bengkel terdekat, produk populer |
| `/workshops` | Peta + list (jarak, rating, buka/tutup, foto), filter & sort, lokasi manual/geolocation |
| `/workshops/[slug]` | Profil, jam buka, montir, layanan, produk, review, tombol Book & Chat |
| `/workshops/[slug]/book` | Pilih kendaraan, layanan, tanggal & slot, keluhan, odometer |
| `/shop` | **BengkelShop**: semua produk lintas bengkel, filter jenis bengkel/kategori/harga |
| `/workshops/[slug]/shop` | Produk satu bengkel |
| `/cart` | Cart lintas bengkel: item dikelompokkan per bengkel, subtotal per bengkel |
| `/checkout` | Pilih pickup/GoSend/ekspedisi **per bengkel** (alamat + ongkir), nomor telepon, metode bayar; membuat satu order per bengkel |
| `/orders`, `/orders/[id]` | Status, pickup code / resi + konfirmasi terima, instruksi bayar, review |
| `/bookings`, `/bookings/[id]` | Status service, estimate approval, riwayat, chat |
| `/vehicles`, `/vehicles/[id]` | CRUD kendaraan, riwayat service, reminder |
| `/chat`, `/chat/[id]` | Daftar percakapan, thread |
| `/notifications`, `/profile`, `/auth/*` | – |

**Workshop — desktop-first**

| Route | Isi |
|---|---|
| `/workshop` | Dashboard: rating rata-rata, distribusi 1–5, review terbaru, service aktif, order perlu disiapkan, pendapatan bulan ini |
| `/workshop/profile` | Data bengkel, alamat + peta picker, jam buka, foto, tipe |
| `/workshop/mechanics` | CRUD montir (nama, telepon, pengalaman, keahlian) |
| `/workshop/services` | Katalog layanan |
| `/workshop/products` | CRUD produk (harga, diskon, berat, stok, foto) |
| `/workshop/bookings` | Daftar booking, confirm/decline |
| `/workshop/service-orders/[id]` | **Start** (odometer, montir) / **Finish** (item, foto, catatan, invoice) |
| `/workshop/orders` | Order toko masuk, preparing → ready |
| `/workshop/orders/[id]` | Verifikasi pickup code **atau** input resi → shipped |
| `/workshop/reviews` | Review + balas |
| `/workshop/chat` | Inbox ala Messenger (list + thread) |
| `/workshop/reports` | Pendapatan jasa/toko, transaksi lunas, layanan & produk terlaris, rating, periode 7/30/90 hari |

**Design system "Night Shift"**

```
bg          #0A0C0B
surface     #121614
surface-2   #191E1B
border      #232A26
text        #F2F5F0
muted       #9AA69E
accent      #C8F751   (hover #D6FF6B, ink-on-accent #0A0C0B)
danger      #FF5C5C
warning     #FFB020
success     #46D39A
```
Font: **Space Grotesk** (heading, next/font) + **Inter** (body). Radius 10px (kartu), 8px (input), 999px (pill). Border 1px. Shadow hanya untuk elemen melayang. Grid maks 1280px, 12 kolom, gutter 24px. Breakpoint 640/768/1024/1280. Angka uang memakai tabular numerals. Fokus keyboard: outline 2px `#C8F751` offset 2px. Semua teks ≥ 4.5:1 kontras.

---

## 10. i18n

- `next-intl`, segmen `/[locale]`, `en` default, `id` alternatif. Redirect `/` → `/en` (atau locale cookie).
- Semua string UI, email, notifikasi, status, dan label enum diterjemahkan.
- Konten user (nama bengkel, deskripsi, produk, chat, review) **ditampilkan apa adanya**.
- Mata uang selalu `Rp` + format `id-ID` (contoh `Rp 125.000`) di kedua locale; tanggal mengikuti locale; jarak km.

---

## 11. Keamanan & Operasional

- Password argon2id; minimal 8 karakter; cek password bocor tidak dilakukan di v1.
- Rate limit: login 5/menit per IP+email, register 3/jam per IP, chat 30 pesan/menit, review 5/jam.
- Validasi input: `class-validator` + whitelist; semua query Prisma terparameterisasi.
- Otorisasi per resource (bengkel hanya akses ID miliknya); test khusus untuk IDOR.
- Helmet, CORS whitelist, cookie `httpOnly` + CSRF header.
- Webhook signature diverifikasi; idempotent.
- Upload: cek mime asli + ukuran; nama file di-generate.
- Log terstruktur (pino), request id; tanpa PII di log.
- Seed: 24 bengkel (8 Jakarta, 8 Bandung, 8 Surabaya; 12 motor / 12 mobil), 5 produk/bengkel, 6 customer, 40 service order, review & chat contoh; gambar dummy lokal di `IndoBengkelDB/seed/assets` (bukan URL eksternal).
- Script: `pnpm db:seed`, `pnpm export:payout --from --to` (CSV: bengkel, order paid, total).

---

## 12. Risiko & Hal yang Diterima

| Risiko | Dampak | Mitigasi v1 |
|---|---|---|
| Tanpa refund | Order `paid` gagal dipenuhi tidak punya jalur uang di aplikasi | Prosedur CLI + manual, didokumentasikan; demo hindari skenario ini |
| Tanpa approval bengkel | Bengkel fiktif/spam | Verifikasi email + status draft/active/suspended yang dikelola bengkel; tidak ada admin platform |
| Ongkir/resi manual | Ongkir tidak akurat vs tarif kurir; resi bisa salah | Tarif transparan dihitung dari berat; resi wajib sebelum `shipped`; customer konfirmasi diterima |
| Tanpa ledger payout | Rekonsiliasi manual | Export CSV; di luar scope MVP |
| Tile OSM publik | Batas pemakaian | Adapter peta; siap ganti provider |
| Prisma + PostGIS | Query geo via raw SQL | Diisolasi di satu repository geo |
| Rating hanya dari transaksi | Butuh data seed yang cukup agar dashboard terlihat hidup | Seed 40 service order + review |
| Estimasi >150% | Alur approval menambah state | Diuji di fase 4 |
| Timezone | Slot bisa meleset | Simpan UTC, konversi di BE berdasarkan `workshops.timezone` |

---

## 13. Rencana Build

| Fase | Isi | Checkpoint |
|---|---|---|
| 1 | Docker compose, skema Prisma + migrasi + PostGIS, auth lengkap (verify/reset/session/CSRF), design system + layout EN/ID | ✅ review |
| 2 | Bengkel: profil, jam buka, peta picker, foto, montir, layanan | – |
| 3 | Customer: kendaraan, pencarian terdekat, halaman bengkel, filter | – |
| 4 | Booking → service order (confirm/start/finish/approval), riwayat, review bengkel | ✅ review |
| 5 | BengkelShop: cart lintas bengkel (order per bengkel), checkout pickup/GoSend/ekspedisi, fake + Midtrans, pickup code + resi, rating produk | – |
| 6 | Chat realtime, notifikasi, email, reminder | – |
| 7 | Laporan bengkel, seed lengkap, i18n audit, polish, pentest dasar, dokumentasi jalan | ✅ review |

Definisi selesai MVP: seluruh alur customer & bengkel berjalan di `docker compose up` tanpa key eksternal, EN/ID berfungsi, seed memenuhi dashboard, dan `SPEC.md` ini terpenuhi.

---

## 14. Di Luar Scope v1

Refund & payout UI, multi-currency, WhatsApp, login montir, multi-cabang, peran admin platform, AI chatbot, aplikasi mobile native, pembayaran langganan, analytics lanjutan, auto-translate konten, verifikasi KTP/NIB, program loyalty. Integrasi API kurir resmi juga di luar scope v1 (ongkir dihitung lokal, resi manual).
