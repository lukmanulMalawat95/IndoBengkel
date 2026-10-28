# PLAN — IndoBengkel v1.0

| Field | Value |
|---|---|
| Dokumen | Delivery Plan |
| Versi | 1.2 (23 Oktober 2026) |
| Acuan | `SPEC.md`, `PRD.md` v1.2, `FSD.md` v1.2, `TSD.md` v1.2 |
| Status | Baseline lokal terintegrasi selesai (FE + NestJS + PostgreSQL + Docker); fitur produksi tersisa |
| Estimasi total | **±28 hari kerja** (1 developer + AI agent, 6 jam efektif/hari) |
| Buffer | 15% sudah termasuk di angka per fase |

> Estimasi adalah perkiraan, bukan komitmen tanggal. Setiap fase berhenti di **checkpoint** untuk review sebelum lanjut.

---

## 0. Status Implementasi (23 Oktober 2026)

**Berjalan end-to-end (Docker Compose lokal):**

- FE Next.js 15 untuk seluruh layar customer dan workshop, EN/ID, Night Shift + Day Shift, skeleton loading.
- NestJS 11 di `/api/v1` + Prisma + PostgreSQL 16: auth cookie sesi, katalog, kendaraan, booking, service order, cart/checkout, pembayaran local test, review, chat REST, notifikasi, konsol bengkel, health.
- Seed deterministik: 24 bengkel (23 aktif), 30 user, 372 layanan, 72 montir, 120 produk, 40 service order, 12 order, 84 review, 3 conversation, 9 notifikasi. Semua bengkel punya owner (`ownerN@indobengkel.test`).
- Media upload: pipeline klien (validasi → kompresi → XHR), `POST /api/uploads` → volume `public/uploads`, `GET /api/uploads/[name]`, kamera + fallback file picker, progres bertahap.
- Docker: `db` (host 55432), `backend` (4000), `frontend` (3000), healthcheck, volume upload, seed eksplisit lewat `npm run stack:seed`.
- Verifikasi: `nest build`, `next build`, `tsc --noEmit`, smoke API, E2E browser customer/owner, upload 1200×800, skeleton.

**Belum (target produksi):**

- Verifikasi Midtrans sandbox + refund/rekonsiliasi, email outbox/Mailpit, Socket.IO, presigned S3/MinIO.
- Multi-foto produk, laporan lintas periode lanjutan.

Fase 1–7 di bawah tetap menjadi rencana produksi; Fase 8 dan 9 mencatat pekerjaan yang sudah selesai. Baseline lokal tidak menggantikan hardening produksi.

**Pemetaan implementasi**

| Area | Lokasi |
|---|---|
| Home + kategori | `IndoBengkelFE/src/app/[locale]/(customer)/page.tsx` |
| Token & utilitas tema | `IndoBengkelFE/src/app/globals.css` (`.chip-accent`, `.progress-sheen`) |
| Pipeline upload | `IndoBengkelFE/src/lib/upload-image.ts` |
| UI upload + kamera | `IndoBengkelFE/src/components/ui/image-upload.tsx` |
| Endpoint upload | `IndoBengkelFE/src/app/api/uploads/route.ts` + `[name]/route.ts` |
| API | `IndoBengkelBE/src/` (auth, catalog, commerce, bookings, workshop, messaging) |
| Skema + seed | `IndoBengkelBE/prisma/schema.prisma`, `prisma/seed-data.json`, `src/seed/` |
| Orkestrasi | `docker-compose.yml`, `IndoBengkelBE/Dockerfile`, `IndoBengkelFE/Dockerfile` |
| i18n | `IndoBengkelFE/messages/{en,id}.json` |
| Catatan desain | `design/README.md` |

---

## 1. Cara Kerja

1. **Satu fase = satu increment yang bisa dijalankan.** Tidak ada fase yang meninggalkan aplikasi rusak.
2. **Checkpoint di fase 1, 4, dan 7** (plus review singkat tiap akhir fase).
3. **Spec adalah kontrak.** Penyimpangan apa pun memperbarui `SPEC.md`/`FSD.md`/`TSD.md` di commit yang sama.
4. **Test gate:** unit + integration wajib hijau sebelum checkpoint; E2E bertahap.
5. **Tidak ada pekerjaan tersembunyi.** Setiap akhir fase ada laporan: apa yang selesai, apa yang ditunda, risiko baru.

**Definition of Done setiap task:** kode + tipe strict + lint bersih + test relevan + string EN/ID + state loading/empty/error + tidak ada `TODO` di jalur utama.

---

## 2. Ringkasan Fase

| Fase | Fokus | Estimasi | Status |
|---|---|---|---|
| 0 | Persetujuan & setup | 0,5 hari | selesai |
| 1 | Fondasi: Docker, DB, auth, design system, i18n | 4 hari | baseline berjalan; JWT/CSRF/email belum |
| 2 | Bengkel: profil, lokasi, jam, montir, layanan, dashboard | 3 hari | baseline berjalan (tanpa closure/jam penuh) |
| 3 | Kendaraan & discovery (peta, pencarian terdekat) | 3 hari | baseline berjalan (PostGIS KNN + radius) |
| 4 | Booking, service order, pembayaran service, review | 4,5 hari | baseline berjalan (pembayaran simulasi) |
| 5 | BengkelShop, cart, checkout pickup/ekspedisi, pembayaran, resi, review produk | 5 hari | baseline berjalan (shipping + resi API) |
| 6 | Chat realtime, notifikasi, email, reminder | 3 hari | REST + notifikasi berjalan; Socket.IO/email belum |
| 7 | Laporan bengkel, seed penuh, i18n audit, hardening, dokumentasi | 3,5 hari | laporan dasar + seed berjalan; hardening belum |
| 8 | Polish UI Home + media upload | 1,5 hari | ✅ selesai |
| 9 | Integrasi backend + DB + Docker + skeleton | 2 hari | ✅ selesai (baseline lokal) |
| 10 | Quality gate: API e2e, browser e2e, CI | 2 hari | ✅ selesai |

---

## 3. Fase 0 — Persetujuan & Setup (0,5 hari)

| ID | Task | Output |
|---|---|---|
| T0.1 | Konfirmasi `SPEC/PRD/FSD/TSD/PLAN` | Persetujuan tertulis |
| T0.2 | `git init`, `.gitignore`, struktur folder | Repo bersih |
| T0.3 | README kerangka + daftar perintah | README |

**Gate:** keempat dokumen disetujui; tidak ada keputusan terbuka.

---

## 4. Fase 1 — Fondasi (4 hari) ✅ Checkpoint

**Tujuan:** aplikasi kosong tapi bisa register, verifikasi, login, refresh, logout, ganti bahasa, dan tampil dengan tema Night Shift.

| ID | Task | Detail |
|---|---|---|
| T1.1 | Docker Compose | `db` (postgis), `minio` + init, `mailpit`, `be`, `fe`; healthcheck; volume; `.env.example` |
| T1.2 | Scaffold BE | NestJS, config zod, pino + request id, global error filter, ValidationPipe, Swagger, `/health` |
| T1.3 | Skema Prisma | Semua tabel SPEC §5 + enum + index + `email_outbox`; migrasi awal + extension PostGIS/trgm/citext |
| T1.4 | Seed minimal | 1 customer + 1 workshop + 1 kendaraan/katalog |
| T1.5 | Auth | Register customer & workshop, verifikasi email (Mailpit), login, refresh rotation + reuse detection, logout/all, lupa/reset, daftar sesi + revoke, CSRF, rate limit, guard role & verified |
| T1.6 | FE scaffold | Next 15, Tailwind token Night Shift, font Space Grotesk/Inter, shadcn, layout publik, proxy `/api`, api client cookie-aware |
| T1.7 | i18n | `next-intl`, `/[locale]`, `en`/`id`, format uang/tanggal, toggle di header |
| T1.8 | Halaman auth | Register customer, register workshop, login, verify, forgot/reset, 403/404 |
| T1.9 | CI | lint + typecheck + unit + build |

**Deliverable:** `docker compose up` → register → email di Mailpit → verify → login → refresh otomatis → logout; UI EN/ID.

**Gate test:** integration auth (register/verify/login/refresh reuse/reset), unit token, build FE, tidak ada kebocoran password di response.

---

## 5. Fase 2 — Bengkel (3 hari)

| ID | Task | Detail |
|---|---|---|
| T2.1 | Profil workshop | CRUD, tipe eksklusif, slug sekali, aturan publikasi `draft→active` |
| T2.2 | Lokasi | Peta picker Leaflet + pencarian Photon, simpan lat/lng + alamat + timezone |
| T2.3 | Jam buka & closure | 7 hari, validasi, tanggal tutup |
| T2.4 | Media | Uploader bersama (file/kamera + progres), cover + galeri maks 6, hapus cover → draft; produksi memakai presign |
| T2.5 | Montir | CRUD + skills tetap + nonaktifkan |
| T2.6 | Katalog layanan | CRUD + nonaktifkan |
| T2.7 | Dashboard (kerangka) | Status profil, booking/order kosong, rating kosong |
| T2.8 | UI | Layout workshop desktop, form + validasi, empty states |

**Gate test:** publish rule (6 syarat), tipe tidak bisa diubah setelah transaksi, upload 5 MB ditolak, jam buka invalid ditolak.

---

## 6. Fase 3 — Kendaraan & Discovery (3 hari)

| ID | Task | Detail |
|---|---|---|
| T3.1 | Kendaraan | CRUD (termasuk foto via uploader), validasi plat/tahun/odometer, blokir hapus jika ada service |
| T3.2 | Geo repository | Query KNN + radius + filter tipe + trgm search; `open_now` |
| T3.3 | Endpoint pencarian | `GET /workshops` + filter + sort + pagination |
| T3.4 | Halaman `/workshops` | Peta + list, geolocation/manual, radius, filter, empty state |
| T3.5 | Detail bengkel | Profil, jam, montir, layanan, produk, review (read), CTA |
| T3.6 | Halaman kendaraan | List + detail + riwayat kosong |
| T3.7 | Seed discovery | 24 bengkel (8 Jakarta, 8 Bandung, 8 Surabaya; 12 motor/12 mobil) + cover lokal |

**Gate test:** urutan jarak benar terhadap 3 titik uji; filter tipe; bengkel draft/suspended tidak muncul; `open_now` benar untuk 3 timezone (WIB/WITA/WIT).

---

## 7. Fase 4 — Booking & Service (4,5 hari) ✅ Checkpoint

| ID | Task | Detail |
|---|---|---|
| T4.1 | Availability | Slot 60 menit dari jam buka, kapasitas, closure, lead time 1 jam, maks 30 hari |
| T4.2 | Booking create | Snapshot layanan → item, validasi kendaraan/tipe/odometer, notifikasi |
| T4.3 | Confirm/decline/reschedule | Advisory lock + cek kapasitas, estimasi wajib |
| T4.4 | Start | Odometer + montir aktif, transisi state |
| T4.5 | Finish | Item jasa/part, foto pekerjaan (maks 4, uploader + progres), catatan, total, potong stok part |
| T4.6 | Approval >150% | `awaiting_approval`, approve/reject, revisi item |
| T4.7 | Payment service | Payment row per service order, fake provider + VA/QRIS/transfer, cash oleh owner, simulasi idempotent, retry setelah expired |
| T4.8 | Cancel/no-show | Aturan 2 jam, alasan owner, no-show 30 menit |
| T4.9 | Riwayat & odometer | Update saat selesai, last workshop |
| T4.10 | Review bengkel | Create, tag, agregat, balas sekali |
| T4.11 | FE | Booking wizard, halaman booking customer, layar Start/Finish owner, invoice, approval, review |
| T4.12 | Dashboard kepuasan | Rating, distribusi, review terbaru, pendapatan service |

**Gate test:** double-confirm tidak melebihi kapasitas; invoice 151% memblokir sampai approve; reject mengembalikan ke in_progress; odometer tidak berubah sebelum selesai; review ganda 409; cash paid mengunlock review.

---

## 8. Fase 5 — Shop & Order (5 hari)

| ID | Task | Detail |
|---|---|---|
| T5.1 | Produk | CRUD, diskon, berat, stok, foto utama via uploader, nonaktif |
| T5.2 | Browse BengkelShop | Marketplace lintas bengkel, filter, sort, drawer detail, stok 0 |
| T5.3 | Cart | Lintas bengkel (satu cart internal per bengkel), qty vs stok, item nonaktif, hapus per bengkel/semua |
| T5.4 | Checkout | Validasi stok transaksional per cart, snapshot, pickup code, fulfillment + ongkir per bengkel (pickup/GoSend/ekspedisi), expiry 60 menit |
| T5.5 | Payment adapter | ✅ `PaymentProvider` + `FakePaymentProvider` + `MidtransPaymentProvider`; Midtrans Core API + signed webhook; fake tetap default |
| T5.6 | Expiry & restore | ✅ Cron per menit, lock per payment, stok kembali, notifikasi; service invoice expired bisa retry |
| T5.7 | Fulfillment | Preparing → Ready + notifikasi, verifikasi pickup code, input resi/booking ID → shipped, confirm delivery |
| T5.8 | Review produk | Per item per order completed, agregat |
| T5.9 | FE | `/shop`, cart lintas bengkel, checkout fulfillment per bengkel, instruksi bayar + polling, order customer (resi + confirm), order owner (ship), verifikasi pickup |
| T5.10 | Midtrans | ✅ Core API VA/QRIS + webhook SHA512 + settlement idempotent; ⏳ verifikasi sandbox dan refund belum |

**Gate test:** stok tidak negatif pada 20 checkout paralel; double-submit tidak membuat dua order; simulasi `paid` ganda tetap satu `paid`; pickup code salah 400; order expired mengembalikan stok; service invoice expired bisa di-retry; review produk hanya setelah completed.

**Status pembayaran:** fake tetap default untuk lokal/CI. Adapter Midtrans dan webhook bertanda tangan sudah diimplementasikan serta diuji dengan mock; verifikasi ke sandbox Midtrans dan refund/rekonsiliasi masih backlog.

---

## 9. Fase 6 — Chat, Notifikasi, Reminder (3 hari)

| ID | Task | Detail |
|---|---|---|
| T6.1 | Conversation & message | REST, aturan siapa boleh memulai, unread, read receipt, tanpa soft delete |
| T6.2 | Socket.IO | Auth cookie, room, event, ack, persist-first |
| T6.3 | Attachment | Pipeline upload bersama (sumber ≤12 MB, kompresi, progres) + validasi + tampilan; produksi presign |
| T6.4 | Notifikasi in-app | Bell, halaman, read-all, matriks event |
| T6.5 | Email | Outbox + worker + template EN/ID + Mailpit/Resend adapter |
| T6.6 | Reminder | Cron 09.00, syarat bulan/km, `reminder_logs`, anti-spam 30 hari |
| T6.7 | FE | Inbox ala Messenger, thread, typing, unread badge, notifikasi |

**Gate test:** dua browser chat < 300 ms; pesan tidak hilang saat salah satu offline; bengkel tidak bisa memulai chat ke customer asing; email masuk Mailpit dengan locale benar; reminder tidak dobel.

---

## 10. Fase 7 — Laporan, Seed, Hardening, Docs (3,5 hari) ✅ Checkpoint

| ID | Task | Detail |
|---|---|---|
| T7.1 | Laporan bengkel | `/workshop/reports`: pendapatan jasa/toko, transaksi lunas, layanan & produk terlaris, rating, filter 7/30/90 hari — hanya bengkel sendiri |
| T7.2 | Seed penuh | 24 bengkel, 120 produk, 6 customer, 40 service order, order toko pickup + ekspedisi (termasuk `shipped`), 60+ review, chat, 5 tanggal closure |
| T7.3 | i18n audit | Scan string hardcoded, lengkapi EN/ID email & error |
| T7.4 | Security sweep | Checklist TSD §14, test IDOR/CSRF/rate limit/upload/webhook |
| T7.5 | Performance | Seed 10k bengkel sementara, ukur search p95 < 300 ms |
| T7.6 | E2E Playwright | 6 alur utama (termasuk ekspedisi → resi → diterima) |
| T7.7 | Polish | Empty/error/loading, responsive 360px, fokus keyboard, kontras |
| T7.8 | Docs | README, akun seed, skrip baseline lokal, arsitektur singkat, changelog |

**Gate final:** seluruh release criteria PRD §13.

---

## 11. Fase 8 — Polish UI & Media Upload (1,5 hari) ✅ Selesai

**Tujuan:** permukaan customer/workshop terasa selesai, dan semua foto masuk lewat uploader nyata — bukan tempelan URL.

| ID | Task | Detail |
|---|---|---|
| T8.1 | Home hero | Opsi 1 · Ringkas: satu panel berisi search + empat kategori sama lebar (tile `.chip-accent` 32 px); di mobile pemilih lokasi berada di dalam field search |
| T8.2 | CTA & aksen | Panel "How it works" memakai badge netral, garis `line`, langkah bernomor; halo `accent/20` diganti `.chip-accent`; varian Badge accent/lime diredupkan |
| T8.3 | Pipeline upload | `src/lib/upload-image.ts`: allowlist jpg/png/webp, sumber ≤12 MB, downscale 1280 px, JPEG ≤340 KB, progres XHR |
| T8.4 | UI upload | `ImageUpload`, `MultiImageUpload`, `UploadProgressBar`, camera sheet (`getUserMedia`, ganti kamera, fallback file picker) |
| T8.5 | Wiring field | Montir, produk, kendaraan, cover + galeri bengkel (maks 6), foto pekerjaan service (maks 4), lampiran chat |
| T8.6 | Endpoint lokal | `POST /api/uploads` → `public/uploads`, respons `{ url: "/api/uploads/<name>" }`; `GET /api/uploads/[name]` menyajikan file; error 400/413/415/503, fallback data URL |
| T8.7 | i18n & docs | Namespace `uploads.*` EN/ID, pembaruan copy console/chat, `design/README.md` + dokumen ini |
| T8.8 | Verifikasi | 360/390/1024/1440 tanpa overflow; E2E tambah montir dengan file 1200×800 → URL `/api/uploads/…` bertahan setelah reload; tanpa error konsol |

**Deliverable:** semua field foto bisa diisi dari file atau kamera dengan progres; Home dan CTA konsisten di Night Shift maupun Day Shift.

**Gate:** tidak ada input URL gambar; hasil upload tampil setelah reload; kontras AA; typecheck bersih.

**Catatan:** endpoint upload sudah session-gated dan menulis ke disk lokal (volume Docker); kepemilikan file dicatat di tabel `Upload` dan referensi lintas akun ditolak. Di produksi, ganti dengan presigned S3/MinIO.

---

## 11b. Fase 9 — Integrasi Backend, DB & Docker (2 hari) ✅ Selesai

**Tujuan:** menghubungkan FE ke API nyata tanpa mengubah pengalaman layar, lalu menjalankan seluruh stack dari satu perintah.

| ID | Task | Detail |
|---|---|---|
| T9.1 | Skema & seed | Prisma 16 model; seed snapshot deterministik eksplisit; 24 bengkel/23 aktif; owner untuk tiap bengkel |
| T9.2 | Auth & guard | Cookie `ib_session` httpOnly + `sessions`; role customer/owner; query kepemilikan |
| T9.3 | Modul API | Auth, katalog, kendaraan, booking, commerce, konsol, messaging, notifikasi, health |
| T9.4 | Integrasi FE | Rewrite `/api/*` → backend; envelope pagination; error handling |
| T9.5 | Docker | Dockerfile BE/FE, compose `db`/`backend`/`frontend`, healthcheck, volume upload, seed eksplisit |
| T9.6 | Skeleton | `PageLoading` bergaya shimmer untuk dashboard/daftar/detail; tidak ada layar kosong saat data dimuat |
| T9.7 | Verifikasi | Build + typecheck; smoke API; E2E customer/owner; upload file + kamera; dokumentasi v1.2 |

**Gate:** `docker compose up --build` → login → semua alur inti → upload bertahan setelah reload; tidak ada error konsol.

**Ditunda ke produksi:** verifikasi Midtrans sandbox, refund/rekonsiliasi, S3/MinIO, Mailpit, Socket.IO.

---

## 11c. Fase 10 — Quality Gate (2 hari) ✅ Selesai

**Tujuan:** menahan regresi sebelum hardening auth/pembayaran, tanpa mengubah kontrak UI.

| ID | Task | Detail |
|---|---|---|
| T10.1 | API integration | Jest + Supertest in-process; schema terisolasi `indobengkel_test`; `db push` + seed di global setup |
| T10.2 | Cakupan alur kritis | Auth/sesi, discovery + availability, booking state machine (150% approval, cash, cancel, no-show), shop order (stok, pickup code, resi), chat/notifikasi, IDOR |
| T10.3 | Browser e2e | Playwright Chromium + mobile viewport terhadap stack Docker; login akun seed, booking, konsol owner, shop, chat |
| T10.4 | CI | GitHub Actions: backend (Postgres service + typecheck + build + test), frontend (typecheck + build), e2e (Docker compose + report/log saat gagal) |

**Deliverable:** `cd IndoBengkelBE && npm test` hijau (66 API test default, 67 saat `REDIS_URL` diset) dan `npm run test:e2e` hijau (9 browser test) di stack lokal; lihat `docs/TESTING.md`.

**Catatan:** celah kontrak yang ditemukan suite API (kapasitas slot saat `confirm`, jam buka/closure, panjang komentar review, kepemilikan upload) sudah ditutup dan memiliki regression test; lihat `docs/TESTING.md`.

---

## 11d. Security Baseline ✅ Selesai

**Tujuan:** menutup vektor penyalahgunaan yang paling murah sebelum produksi, tanpa mengubah kontrak UI.

| ID | Task | Detail |
|---|---|---|
| T11d.1 | CSRF | Double-submit `ib_csrf` + `X-CSRF-Token` untuk semua mutasi ber-sesi; endpoint bootstrap di-exempt |
| T11d.2 | Cookie & header | `Secure` opt-in via `COOKIE_SECURE`, SameSite=Lax, Helmet, CORS allowlist + `X-CSRF-Token` |
| T11d.3 | Rate limit | Guard fixed window: global 1200/menit, login/register 10/menit per IP+email, chat 30, review 10; counter Redis + fallback memory |
| T11d.4 | Upload | Wajib sesi valid (`GET /auth/me`), batas 5 MB, verifikasi magic bytes jpg/png/webp, nama acak |
| T11d.5 | Verifikasi | `test/security.e2e-spec.ts` (cookie flags, CSRF 403/201, 429 + Retry-After); suite API 50 hijau; E2E browser tetap hijau |

**Catatan:** counter rate limit dibagikan lewat Redis (lihat §11f) dengan fallback per-proses bila Redis tidak tersedia. Kepemilikan file belum dilacak di DB (lihat `docs/TESTING.md`).

---

## 11e. Versioned Migrations ✅ Selesai

**Tujuan:** menjadikan perubahan skema dapat direview, diulang, dan dideploy tanpa `db push` yang berisiko.

| ID | Task | Detail |
|---|---|---|
| T11e.1 | Baseline | `prisma/migrations/0_init` (384 baris SQL) dari `migrate diff --from-empty`; ditandai applied di DB lokal yang sudah ada |
| T11e.2 | Runtime | Dockerfile + compose menjalankan `prisma migrate deploy` sebelum seed/start; `db:migrate`, `db:migrate:dev`, `db:status` |
| T11e.3 | CI | Backend job menerapkan migrasi ke DB kosong lalu gagal jika `schema.prisma` drift (`migrate diff --exit-code`) |
| T11e.4 | Test | Schema tes tetap memakai `db push` (disposable); verifikasi fresh schema + diff bersih dijalankan manual |

**Deliverable:** `migrate deploy` sukses di schema kosong dan di DB existing; `migrate status` up to date; build Docker + E2E hijau.

**Catatan:** setiap perubahan `schema.prisma` wajib disertai migrasi baru; jangan mengedit migrasi yang sudah di-commit.

---

## 11f. Distributed Rate Limiting (Redis) ✅ Selesai

**Tujuan:** membuat counter rate limit konsisten saat API dijalankan lebih dari satu replica, tanpa mengorbankan ketersediaan bila Redis down.

| ID | Task | Detail |
|---|---|---|
| T11f.1 | Store | `RateLimitStore` dengan implementasi Redis (Lua atomic `INCR` + `PEXPIRE`) dan memory; key di-hash agar email/PII tidak masuk Redis |
| T11f.2 | Fallback | Jika Redis tidak siap/putus, guard memakai memory per-proses dan mencatat warning maksimal sekali per menit |
| T11f.3 | Runtime | Service `redis:7-alpine` di compose (tanpa persistensi, maxmemory 64 MB, `allkeys-lru`), healthcheck, dan `REDIS_URL` di backend |
| T11f.4 | CI/Test | Redis 7 sebagai service di job backend; `test/security.e2e-spec.ts` menguji 429 + `Retry-After` lewat Redis; suite juga hijau tanpa Redis (memory) |
| T11f.5 | Verifikasi | Clean Docker build, log `Rate limiting shared through Redis`, key `ib:ratelimit:*` dengan TTL, 51 test API (Redis aktif) + 8 E2E hijau |

**Catatan:** fallback sengaja memilih ketersediaan; saat outage berkepanjangan setiap replica menegakkan counter sendiri. Redis belum dipakai untuk Socket.IO atau cache lain.

---

## 11g. PostGIS Nearest Search ✅ Selesai

**Tujuan:** memindahkan pencarian terdekat dari haversine di memori ke PostgreSQL, dengan radius dan pagination yang benar di SQL.

| ID | Task | Detail |
|---|---|---|
| T11g.1 | Image DB | `postgres:16-alpine` → `postgis/postgis:16-3.4-alpine` di `docker-compose.yml` dan service Postgres CI; volume lama tetap kompatibel |
| T11g.2 | Migrasi | `1_postgis_workshop_location`: `CREATE EXTENSION postgis` + GiST index ekspresi pada `ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography`; tidak ada kolom `Unsupported`, `migrate diff` tetap bersih |
| T11g.3 | Repository | `WorkshopGeoRepository` (raw SQL berparameter) untuk KNN, radius, tipe, rating, pencarian, `open_now`, dan pagination; `CatalogService` hanya merangkai hasil dengan relasi Prisma |
| T11g.4 | Kontrak | `GET /workshops` tetap sama: `distanceKm`, `openNow`, `nextSlot`, `{ data, meta }`; `meta.total` kini dihitung di SQL dan konsisten dengan filter |
| T11g.5 | Test | Test setup membuat extension + index setelah `db push`; suite discovery menguji jarak vs haversine (toleransi 1%), paritas `openNow`, radius, dan `total` halaman di luar rentang |
| T11g.6 | Verifikasi | `EXPLAIN` memakai `Index Scan using "Workshop_location_gist"`; 53 test API hijau; 4 E2E browser (discovery + mobile) hijau |

**Catatan:** `ORDER BY` jarak tidak boleh diberi tie-breaker karena mematikan index scan; `total` memakai query `COUNT(*)` terpisah karena `COUNT(*) OVER ()` memaksa semua baris diproses sebelum `LIMIT`. Detail bengkel tetap memakai haversine (satu baris, tanpa filter).

---

## 11h. Booking, Review & Upload Contract Gaps ✅ Selesai

**Tujuan:** menutup empat celah kontrak yang sebelumnya hanya didokumentasikan di `docs/TESTING.md`.

| ID | Task | Detail |
|---|---|---|
| T11h.1 | Slot bersama | `src/common/slots.ts` menjadi satu sumber aturan slot (zona waktu bengkel via `Intl`, jam buka, closure, kelipatan jam); availability, create, dan confirm memakainya |
| T11h.2 | Validasi booking | Create menolak timestamp tidak bulat (`VALIDATION_ERROR`), di luar jam buka/closure (`WORKSHOP_CLOSED`), dan slot penuh (`SLOT_FULL`) di dalam transaksi dengan lock baris `Workshop` |
| T11h.3 | Confirm | `POST /workshop/bookings/:id/confirm` mengunci workshop, membaca order di dalam transaksi, dan menghitung ulang `confirmed`/`in_progress` pada slot sebelum update |
| T11h.4 | Review | Komentar opsional, tetapi jika diisi wajib 10–500 karakter di kedua jalur review; dialog FE memakai batas yang sama |
| T11h.5 | Upload | Model `Upload` (owner, name, mime, size) + `POST /api/v1/uploads`; route FE mendaftarkan file setelah menulis; interceptor global menolak referensi `/api/uploads/...` milik akun lain |
| T11h.6 | Test | Suite `uploads` baru (6 test); booking-lifecycle menguji jam tutup/closure/slot tidak bulat/kapasitas saat confirm; review panjang komentar di booking + shop |
| T11h.7 | Verifikasi | 61 test API hijau (1 Redis skip), 8 E2E browser hijau, `migrate diff` bersih, stack Docker di-rebuild |

**Catatan:** lock `SELECT ... FOR UPDATE` pada baris workshop membuat dua konfirmasi bersamaan tidak bisa mengambil slot terakhir; `requested` tetap tidak memakai kapasitas.

---

## 12. Milestone & Baseline Lokal

| Milestone | Isi baseline |
|---|---|
| M1 (akhir F1) | Register → verifikasi email → login → ganti bahasa |
| M2 (akhir F3) | Cari bengkel terdekat, filter motor/mobil, lihat detail |
| M3 (akhir F4) | Booking → konfirmasi → start → finish → approval → bayar → review |
| M4 (akhir F5) | BengkelShop → cart lintas bengkel → checkout per bengkel → bayar → pickup code / resi → review produk |
| M5 (akhir F7) | Chat dua arah, notifikasi, dashboard bengkel, laporan bengkel |

**Skrip baseline lokal 10 menit (runtime lokal Docker):**
1. `npm run stack:up` → buka `http://localhost:3000`; tunjukkan 23 bengkel aktif dan Home tanpa horizontal scroll di 360 px.
2. Login customer seed (`rina@indobengkel.test`, password dari `SEED_PASSWORD`) → booking Kawah Motor Works untuk besok → pilih layanan.
3. Login owner (`andi@kawahmotor.test`, password dari `SEED_PASSWORD`) → konfirmasi booking → start dengan montir → complete dengan invoice → cash lunas.
4. Tambah montir dengan foto dari file dan kamera → progres unggah → simpan → reload untuk membuktikan `/api/uploads/...` bertahan.
5. Kembali sebagai customer → lihat booking `paid` → review bengkel.
6. BengkelShop: tambah oli → cart → checkout pickup → pembayaran local test.
7. Owner: order paid → preparing → ready → verifikasi pickup code.
8. Chat dua arah (termasuk kirim gambar) dan notifikasi.
9. Dashboard + laporan owner: pendapatan, transaksi, rating.
10. Toggle EN ↔ ID dan Night Shift ↔ Day Shift; tunjukkan skeleton saat data dimuat.

---

## 13. Dependensi & Critical Path

```
F8 (UI + upload) ──▶ F9 (API + DB + Docker) ──▶ F1–F7 hardening produksi
```

| Dependensi | Dibutuhkan di | Status |
|---|---|---|
| Midtrans sandbox key | F5 (untuk verifikasi adapter/webhook; fake tetap default) | dari kamu |
| Logo/aset brand | F1 (opsional; wordmark sementara) | dari kamu |
| Persetujuan dokumen v1.2 | F0/review | dari kamu |
| Photon instance | F2/F3 | belum; pencarian terdekat sudah PostGIS, geocoder belum |
| Storage presigned (MinIO/S3) | F2/F7 — mengganti `/api/uploads` | belum |

---

## 14. Risiko Jadwal

| Risiko | Dampak | Rencana |
|---|---|---|
| Scope merembet (delivery, refund, AI) | +3–7 hari | Ditolak di v1; masuk backlog |
| Midtrans sandbox terkendala | Verifikasi live tertunda | Fake provider menjaga alur; adapter/webhook diuji dengan mock dan signature lokal |
| PostGIS + Prisma menyita waktu | +1 hari | Selesai: index ekspresi menghindari `Unsupported`, raw SQL diisolasi di `WorkshopGeoRepository`, `migrate diff` tetap bersih |
| Socket.IO single instance | Tidak scale | Diterima v1; Redis sudah ada untuk rate limit, adapter Socket.IO menyusul |
| Seed data kurang meyakinkan | Baseline terasa kosong | Dikerjakan bertahap sejak F3, final di F7 |
| Upload lokal bergantung disk | Gagal di deploy read-only | Volume Docker; fallback data URL; produksi memakai presigned storage |
| Integrasi API berbeda dari ekspektasi | Perilaku berubah saat backend aktif | Smoke API + E2E browser dijalankan pada stack Docker |
| Belum ada test otomatis | Regresi lolos | Tambah Jest/Playwright sebelum hardening |
| Review menemukan masalah desain | Rework | Checkpoint F1/F4/F7 |

---

## 15. Yang Dibutuhkan dari Kamu

1. **Review** dokumen v1.2 (PRD, FSD, TSD, PLAN) dan stack lokal yang sudah berjalan.
2. **Uji alur** di `http://localhost:3000` dengan akun seed lokal; catat koreksi.
3. **Opsional berikutnya:** logo/wordmark, akun Midtrans sandbox untuk verifikasi live, keputusan object storage.
4. **Saat checkpoint:** review aplikasi berjalan + daftar koreksi; saya perbaiki sebelum hardening.

---

## 16. Setelah MVP (Backlog, Tidak Dikerjakan Sekarang)

| Prioritas | Item |
|---|---|
| P1 | Verifikasi Midtrans sandbox + refund/rekonsiliasi, email outbox/Mailpit, Socket.IO realtime |
| P1 | Presigned S3/MinIO + multi-foto produk |
| P1 | Refund & pembatalan setelah bayar; ledger payout; halaman payout |
| P1 | Pengiriman lokal + tarif berat (motor/pickup/truk) |
| P1 | Approval bengkel + verifikasi dokumen |
| P2 | Login montir + penugasan & jadwal |
| P2 | Multi-cabang |
| P2 | AI chatbot + handoff ke manusia |
| P2 | WhatsApp notification |
| P3 | Multi-currency, ekspansi internasional |
| P3 | Program loyalty, iklan bengkel, analytics lanjutan |
| P3 | Aplikasi mobile native |

---

## 17. Change Control

- Perubahan scope → tulis di `docs/CHANGELOG.md` + perbarui PRD/FSD/TSD.
- Perubahan skema → migrasi baru (tidak mengedit migrasi lama).
- Perubahan desain → token di `design/tokens.json` + `DESIGN.md` bila sudah ada.
- Setiap checkpoint menghasilkan catatan: selesai / ditunda / risiko baru.

**Riwayat dokumen:** v1.2 (23 Oktober 2026) — backend NestJS + PostgreSQL + seed + Docker Compose terintegrasi, skeleton loading, upload `/api/uploads`, status dokumen disinkronkan. v1.1 (22 Oktober 2026) — media upload (file + kamera + progres), Fase 8 baseline FE.
