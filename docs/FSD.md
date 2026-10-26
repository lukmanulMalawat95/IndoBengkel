# FSD — IndoBengkel v1.0

| Field | Value |
|---|---|
| Dokumen | Functional Specification |
| Versi | 1.2 (23 Oktober 2026) |
| Acuan | `SPEC.md`, `PRD.md` v1.2, `design/README.md` |
| Status | Final untuk MVP — FE + NestJS API + PostgreSQL berjalan lokal (Docker Compose) |
| Konvensi ID | `F-xx` = fitur, `AC-xx.n` = acceptance criteria |

Dokumen ini menjelaskan **perilaku sistem**. Skema data, endpoint, dan keputusan teknis ada di `TSD.md`; keputusan produk ada di `SPEC.md`. Di mana runtime lokal (API + upload disk) berbeda dari target produksi, perbedaannya ditandai eksplisit.

---

## 1. Aktor & Permission

| Aksi | Customer | Workshop Owner |
|---|---|---|
| Registrasi, verifikasi email, login | ✅ | ✅ |
| Lihat bengkel/produk/review | ✅ | ✅ |
| CRUD kendaraan sendiri | ✅ | ✅ sebagai customer |
| Booking service | ✅ | ✅ sebagai customer |
| Konfirmasi/tolak/start/finish service | – | ✅ miliknya |
| Bayar service online / pilih cash | ✅ | ✅ sebagai customer |
| Tandai cash lunas / no-show | – | ✅ |
| CRUD montir, layanan, produk miliknya | – | ✅ |
| Unggah foto (cover, galeri, montir, produk, kendaraan, service, chat) | ✅ untuk resource sendiri | ✅ untuk resource milik bengkelnya |
| Checkout & bayar order (pickup/ekspedisi) | ✅ | ✅ sebagai customer |
| Preparing/Ready/verifikasi pickup/input resi | – | ✅ miliknya |
| Konfirmasi terima barang ekspedisi | ✅ | ✅ sebagai customer |
| Chat | ✅ ke bengkel mana pun | ✅ sebagai customer + ✅ melayani customer bengkelnya |
| Review bengkel | ✅ setelah service `paid` | ✅ sebagai customer + balas 1× |
| Review produk | ✅ setelah order `completed` | ✅ sebagai customer |
| Laporan bengkel | – | ✅ hanya bengkelnya |
| Lihat order | miliknya | miliknya + order bengkelnya di konsol |

**Aturan umum:** satu email = satu role; akun `suspended` tidak bisa login; bengkel `suspended` tidak muncul di pencarian dan tidak bisa menerima booking/order baru, tetapi order yang sudah ada tetap bisa diselesaikan. Workshop Owner memakai halaman customer yang sama untuk kebutuhan pribadinya; konsol bengkel tetap hanya menampilkan data bengkelnya. **Tidak ada peran admin platform** — tidak ada endpoint atau halaman lintas-bengkel di konsol.

**Runtime saat ini:** seluruh perilaku di bawah ini dijalankan oleh FE Next.js yang memanggil NestJS `/api/v1` dan PostgreSQL melalui proxy same-origin. FE tetap bisa dijalankan dengan mock API `localStorage` (`NEXT_PUBLIC_USE_MOCK_API=true`) untuk demo tanpa backend. Upload memakai `POST /api/uploads` dan disajikan lewat `GET /api/uploads/[name]` (lihat F-41). Pembayaran memakai simulasi; chat memakai refetch/polling, belum Socket.IO.

---

## 2. Autentikasi & Akun

### F-01 — Registrasi Customer

**Aktor:** pengunjung.
**Prasyarat:** belum login; email belum terdaftar.

**Alur utama:**
1. Isi `full_name`, `email`, `phone`, `password`, `confirm_password`.
2. Setuju Syarat & Privasi (checkbox wajib).
3. Sistem membuat user `role=customer`, `status=active`, `email_verified_at=null`.
4. Sistem mengirim email verifikasi (token 24 jam) dan menampilkan layar "Check your email".
5. Setelah verifikasi, customer diarahkan ke halaman utama dan dapat bertransaksi.

**Alternatif/error:**
- Email sudah terdaftar → `409 EMAIL_TAKEN` (pesan generik: "If this email exists, check your inbox" pada resend; pada register tetap jelas agar UX).
- Email verification belum dilakukan → login berhasil, tetapi semua aksi transaksi diblokir `403 EMAIL_NOT_VERIFIED` dan muncul banner "Verify your email" + tombol resend.
- Password lemah → `422 WEAK_PASSWORD`.

**Validasi:** nama 2–80; email RFC 5322 maks 254; phone `+62` 9–15 digit (spasi/strip dinormalisasi); password ≥8, mengandung huruf & angka; konfirmasi sama.

**AC:**
- AC-01.1 Email unik case-insensitive.
- AC-01.2 Password disimpan Argon2id, tidak pernah dikembalikan API.
- AC-01.3 Resend verifikasi maks 3×/jam.
- AC-01.4 Setelah verifikasi, `email_verified_at` terisi dan banner hilang.

---

### F-02 — Registrasi Workshop

**Aktor:** pengunjung.
**Prasyarat:** email belum terdaftar.

**Alur utama:**
1. Isi data akun (nama pemilik, email, phone, password) + data bengkel minimal: nama bengkel, tipe (`motor`/`mobil`), phone bengkel, alamat, koordinat, timezone.
2. Sistem membuat user `workshop_owner` + workshop `status=draft`.
3. Email verifikasi dikirim.
4. Setelah email terverifikasi, owner melengkapi profil (jam buka, cover, deskripsi).
5. Begitu syarat publikasi terpenuhi, status otomatis `active` dan bengkel muncul di pencarian. **Tidak ada approval admin.**

**Syarat publikasi (semua wajib):** nama, tipe, phone, alamat lengkap, koordinat valid, timezone, minimal 1 hari buka, cover image, email terverifikasi.
**Alternatif:** bengkel dengan tipe `motor` tidak bisa melayani kendaraan `mobil` (dan sebaliknya).

**AC:**
- AC-02.1 Satu owner hanya boleh punya satu workshop.
- AC-02.2 Workshop `draft` tidak muncul di pencarian maupun dapat di-booking.
- AC-02.3 Mengubah nama bengkel tidak mengubah slug setelah publish.
- AC-02.4 Halaman publik hanya untuk `active`; `suspended` menampilkan 404.

---

### F-03 — Verifikasi Email

**Alur:** link `/auth/verify-email?token=…` → token di-hash & dicocokkan → `email_verified_at` diisi → token `used_at` → redirect ke login/beranda dengan toast.
**Error:** token kedaluwarsa/terpakai → halaman "Link expired" + tombol kirim ulang.
**AC:** token single-use; masa berlaku 24 jam; verifikasi tidak mengubah role.

---

### F-04 — Login, Logout, Sesi

**Alur login:** email + password → validasi kredensial → cek status akun → buat baris `sessions` + set cookie `ib_session` (`httpOnly`, `SameSite=Lax`, 7 hari) dan cookie `ib_csrf` → redirect sesuai role (`/` customer, `/workshop` owner). Mutasi ber-sesi mengirim `X-CSRF-Token`; rate limit login/register aktif di baseline.
**Error:** kredensial salah → pesan generik "Email or password is incorrect" (tidak membocorkan apakah email terdaftar); akun suspended → `403 ACCOUNT_SUSPENDED`.
**Logout:** revoke sesi aktif, hapus cookie. **Logout all:** revoke semua sesi.
**Sesi:** multi-device diizinkan; halaman Profil menampilkan daftar perangkat (user agent, IP, terakhir dipakai) + tombol revoke.
**AC:**
- AC-04.1 Refresh token rotation; token lama tidak bisa dipakai ulang.
- AC-04.2 Reuse token yang sudah dirotasi → seluruh sesi keluarga dicabut.
- AC-04.3 Setelah reset password, semua sesi lain dicabut.
- AC-04.4 Cookie `httpOnly`, `SameSite=Lax`, `Secure` di produksi.

---

### F-05 — Lupa & Reset Password

**Alur:** masukkan email → selalu tampilkan "If the email exists, a link was sent" → email berisi token 60 menit → halaman reset (password baru + konfirmasi) → semua sesi dicabut → login ulang.
**AC:** token single-use; rate limit 3/jam per email; password mengikuti aturan F-01.

---

### F-06 — Bahasa Antarmuka (EN/ID)

**Alur:** toggle di header/profil → simpan `users.locale` (login) atau cookie `locale` (anonim) → reload route `/[locale]`.
**Aturan:** default `en`; semua string UI, email, notifikasi, label status, dan pesan validasi diterjemahkan; konten user tidak diterjemahkan; mata uang selalu `Rp` format `id-ID`.
**AC:** tidak ada string hardcoded; URL berbeda per locale; preferensi bertahan antar sesi.

---

## 3. Bengkel

### F-07 — Profil Bengkel

**Alur:** owner membuka `/workshop/profile` → edit nama, deskripsi (≤2000), tipe (read-only setelah ada transaksi), phone, alamat, koordinat, timezone, cover, galeri → simpan.
**Aturan:** perubahan tipe hanya boleh jika belum ada service/order; alamat & koordinat wajib valid; deskripsi/logo opsional; slug dibuat sekali.
**AC:** perubahan langsung tampil di halaman publik; validasi koordinat (−90..90, −180..180); status publikasi dihitung ulang setiap simpan.

---

### F-08 — Lokasi, Jam Buka, dan Closure

**Alur:** pilih lokasi via pencarian Photon atau klik/drag pin di peta → simpan alamat & lat/lng. Atur jam buka 7 hari (buka/tutup atau tutup) → tambah tanggal closure (mis. libur Lebaran) + alasan opsional.
**Aturan:** `close_time > open_time` (tanpa lintas tengah malam); minimal 1 hari buka; closure menang atas jam buka; tanggal closure tidak boleh masa lalu.
**Perhitungan "open now":** konversi waktu sekarang ke `workshops.timezone` → cek closure hari ini → cek jam buka hari itu → `open_now = true/false`.
**AC:** slot yang dihasilkan hanya dari jam buka dan tidak termasuk closure; status buka/tutup konsisten di list, detail, dan availability.

---

### F-09 — Foto Bengkel

**Alur:** owner membuka editor profil → memilih **Choose photo** (file picker/drag & drop) atau **Take photo** (kamera) → pratinjau lokal langsung tampil → progres unggah berjalan (Reading → Optimising → Uploading → Finishing) → setelah selesai thumbnail memakai URL hasil unggah. Cover wajib untuk publish; galeri maksimal 6 foto; setiap foto bisa diganti atau dihapus.
**Validasi:** `image/jpeg`, `image/png`, atau `image/webp`; ukuran sumber ≤12 MB; gambar diperkecil ke sisi terpanjang 1280 px dan dikompresi ke target ≤340 KB di browser. Rasio disarankan 16:9.
**Aturan:** tidak ada field URL gambar. Kamera memakai `getUserMedia`; bila izin/perangkat tidak tersedia, tampil pesan dan tombol fallback ke file picker. Upload yang gagal tidak mengubah nilai lama; pengguna bisa mencoba lagi.
**Catatan produksi:** di backend, file diunggah lewat presigned URL (lihat `TSD.md` §12); kontrak UI dan perilaku progres tidak berubah.
**AC:**
- AC-09.1 Cover tampil di kartu pencarian dan halaman detail.
- AC-09.2 Menghapus cover saat `active` memaksa status kembali `draft` sampai cover baru diunggah.
- AC-09.3 Galeri menolak foto ke-7 dan menampilkan counter `n of 6`.
- AC-09.4 Progres menampilkan tahap dan persentase; tombol lain di kartu foto nonaktif selama unggah.
- AC-09.5 Foto tetap tampil setelah halaman dimuat ulang.

---

### F-10 — Montir

**Alur:** CRUD montir: nama (2–80), phone, pengalaman 0–60 tahun, keahlian (multi-select dari daftar tetap: `general, engine, electrical, body, tire, ac, transmission`), foto opsional (1 foto via uploader bersama, file atau kamera), status aktif.
**Aturan:** montir nonaktif tidak bisa di-assign ke service order baru; montir yang sudah dipakai tidak dihapus permanen, hanya dinonaktifkan.
**AC:** minimal satu montir aktif diperlukan untuk menekan **Start Service**.

---

### F-11 — Katalog Layanan

**Alur:** CRUD layanan: nama (3–80), deskripsi (≤500), harga (1–100.000.000), durasi 15–480 menit, aktif.
**Aturan:** layanan yang sudah dipakai di service order tidak bisa dihapus, hanya dinonaktifkan; layanan nonaktif tidak muncul di halaman booking.
**AC:** harga layanan di-snapshot saat booking; perubahan harga tidak mengubah order lama.

---

### F-12 — Dashboard Bengkel

**Isi:**
- Rating rata-rata + jumlah review + distribusi 1–5.
- Review terbaru (5) dengan tombol balas.
- Booking hari ini & mendatang; service order aktif (`confirmed`, `in_progress`, `awaiting_approval`).
- Order produk yang butuh aksi (`paid` belum `preparing`, `preparing` belum `ready`).
- Pendapatan bulan berjalan: total service `paid` + order `completed` (cash + online).
- Status profil: draft + daftar syarat yang belum terpenuhi.
**AC:** angka mengikuti timezone bengkel; kosong → empty state dengan CTA; tidak ada data customer di luar bengkel sendiri.

---

## 4. Kendaraan & Discovery

### F-13 — Kendaraan Customer

**Alur:** tambah kendaraan: jenis (`motor`/`mobil`), merek, model, tahun, plat, warna, odometer awal, foto (uploader bersama, file atau kamera), interval reminder (bulan/km).
**Validasi:** tahun 1900–tahun depan; plat 3–12 karakter alfanumerik + spasi, uppercase; odometer 0–2.000.000; plat unik per customer.
**Aturan:** odometer hanya berubah lewat service order; customer boleh mengedit data non-odometer; hapus hanya jika belum ada service order (jika ada → tampilkan penjelasan).
**AC:** kendaraan `mobil` hanya bisa booking bengkel `mobil`; riwayat menampilkan bengkel, tanggal, montir, odometer masuk/keluar, item, total, catatan.

---

### F-14 — Pencarian Bengkel

**Alur:**
1. Minta geolocation (opsional). Jika ditolak → default Jakarta + banner "Enable location".
2. Pencarian manual: ketik kota/alamat → Photon → pilih hasil → set pusat pencarian.
3. Sistem query bengkel `active` dalam radius (default 10 km, 1–100 km) bertipe sesuai filter.
4. Tampilkan peta (pin) + list urut terdekat: cover, nama, jarak, rating, jumlah review, status buka/tutup, jenis, "Book" & "Chat".
**Filter:** jenis (`motor`/`mobil`/semua), buka sekarang, rating minimum, kata kunci nama/alamat. **Sort:** terdekat (default), rating, nama.
**Aturan:** bengkel tanpa cover tidak tampil; jarak <1 km ditampilkan meter, ≥1 km satu desimal; hasil kosong menyarankan memperbesar radius; pagination 20.
**AC:** urutan benar terhadap koordinat pusat; status buka dihitung timezone bengkel; filter tidak merusak pagination.

---

### F-15 — Halaman Detail Bengkel

**Isi:** cover & galeri, nama, tipe, alamat + peta, jarak, status buka + jam hari ini, deskripsi, rating & distribusi, review (pagination), montir aktif, layanan aktif, produk aktif, CTA **Book service**, **Chat**, tombol arah (Google Maps/OSM).
**Aturan:** jika kendaraan customer tidak cocok tipe → CTA Book disabled dengan penjelasan + tautan tambah kendaraan; jika tutup → tetap bisa booking untuk tanggal lain; bengkel `suspended` → 404.
**AC:** semua data hanya dari bengkel tersebut; review tersembunyi tidak tampil; CTA chat membuat/membuka conversation.

---

## 5. Booking & Service Order

### F-16 — Membuat Booking

**Prasyarat:** email terverifikasi; punya kendaraan bertipe sama; bengkel `active`.

**Alur:**
1. Pilih kendaraan.
2. Pilih ≥1 layanan (harga & durasi ditampilkan; snapshot ke item order).
3. Pilih tanggal (hari ini s/d 30 hari) dan slot 60 menit yang tersedia.
4. Isi keluhan (10–1000), odometer (wajib, ≥ odometer terakhir kendaraan), catatan opsional.
5. Kirim → service order `requested`, notifikasi ke bengkel & customer.

**Aturan slot:** minimal 1 jam dari sekarang; hanya jam buka; bukan closure; kapasitas per slot = `slot_capacity_per_hour`; **hanya status `confirmed` dan `in_progress` yang memakai kapasitas** — `requested` tidak mengunci slot.
**Alternatif/error:** slot penuh → `409 SLOT_FULL`; tipe kendaraan tidak cocok → `422 VEHICLE_TYPE_MISMATCH`; bengkel tutup pada tanggal itu → `422 WORKSHOP_CLOSED`; odometer lebih kecil → `422 ODOMETER_TOO_LOW`.

**AC:**
- AC-16.1 Estimated total awal = jumlah harga layanan terpilih.
- AC-16.2 Booking `requested` muncul di dashboard bengkel dan dapat dikonfirmasi.
- AC-16.3 Customer dapat membatalkan selama masih `requested`.

---

### F-17 — Konfirmasi / Tolak Booking

**Alur owner:** buka booking `requested` → lihat kendaraan, keluhan, odometer, layanan → **Confirm** dengan `estimated_total` (default = jumlah layanan, boleh diubah 1–100.000.000) atau **Decline** dengan alasan (5–500).
**Aturan:** saat confirm, cek kapasitas ulang dalam transaksi; jika penuh → `409 SLOT_FULL` dan owner memilih slot lain (reschedule) atau menolak. Reschedule memicu notifikasi.
**AC:** customer menerima notifikasi + estimasi di halaman booking; `declined` menampilkan alasan; data kendaraan tidak bisa diubah setelah confirm.

---

### F-18 — Start Service

**Prasyarat:** status `confirmed`; minimal 1 montir aktif.
**Alur:** owner menekan **Start** → isi odometer aktual (≥ `odometer_in`, ≥ odometer terakhir kendaraan) → pilih ≥1 montir → status `in_progress`, `started_at` diisi.
**AC:** customer menerima notifikasi "Service started"; odometer kendaraan **belum** berubah sampai selesai; start ganda ditolak `409 INVALID_TRANSITION`.

---

### F-19 — Finish Service & Invoice

**Alur:** owner menekan **Finish** → kelola item (jasa/part): nama, qty 1–99, harga satuan; tambah item dari katalog layanan atau produk bengkel (opsional); unggah maks 4 foto pekerjaan (file/kamera, progres per foto); isi catatan montir (≤2000); sistem menghitung `final_total = Σ(qty × unit_price)`.
**Aturan:** minimal 1 item; total > 0; item produk yang dipakai mengurangi stok produk (jika stok kurang → `409 INSUFFICIENT_STOCK`); jika `final_total > 1.5 × estimated_total` → status `awaiting_approval`.
**AC:** invoice menampilkan rincian, foto, montir, odometer; customer tidak bisa membayar sebelum `completed`; item tidak bisa diubah setelah `paid`.

---

### F-20 — Approval Invoice >150%

**Alur:** sistem menghitung rasio → `awaiting_approval` → customer menerima notifikasi → halaman booking menampilkan perbandingan estimasi vs final + rincian → **Approve** (status `completed`) atau **Reject** (kembali `in_progress` dengan catatan customer).
**Aturan:** reject tidak membatalkan service; owner merevisi item hingga total ≤150% atau menjelaskan kembali. Customer tidak bisa approve order milik orang lain.
**AC:** tidak ada notifikasi ganda; keputusan tercatat di `service_order_events`; rasio tepat 150% tidak memerlukan approval.

---

### F-21 — Pembayaran Service

**Alur online:** status `completed` → customer pilih metode (VA/transfer/QRIS) → payment dibuat → instruksi tampil → webhook/simulasi → `paid`, `paid_at` → review terbuka.
**Alur cash:** customer memilih bayar di bengkel → owner menekan **Mark cash paid** (hanya saat `completed`) → `paid` + `cash_recorded_by`.
**Aturan:** satu pembayaran `paid` per service order; pembayaran online kedaluwarsa 60 menit (bisa membuat ulang); jika sudah `paid`, tombol bayar hilang.
**AC:** status service berubah hanya oleh webhook valid/simulasi/cash; pembayaran ganda tidak menghasilkan dua `paid`.

---

### F-22 — Pembatalan & No-show

- Customer: boleh batal bebas jika ≥2 jam sebelum slot (status `requested`/`confirmed`); jika <2 jam tombol batal disabled dengan pesan "Contact the workshop"; owner dapat membatalkan dari sisinya dengan alasan.
- Owner: cancel wajib alasan; notifikasi ke customer.
- No-show: owner menandai setelah `scheduled_at + 30 menit`, hanya dari `confirmed`; tidak ada penalti.
**AC:** pembatalan tidak menghapus riwayat; status akhir tidak bisa diubah lagi.

---

### F-23 — Riwayat & Odometer

**Alur:** halaman kendaraan menampilkan daftar service (`completed`/`paid`/`in_progress`/`cancelled`) + detail.
**Aturan:** saat `completed`/`paid`, `vehicles.odometer_km = odometer_out` dan `last_service_at` diisi; “last workshop” = service terakhir yang `paid`.
**AC:** riwayat hanya menampilkan data bengkel yang bersangkutan untuk sisi bengkel; customer melihat semua bengkel yang pernah ia gunakan.

---

## 6. Shop & Order

### F-24 — Produk

**Alur:** owner CRUD produk: judul (3–120), deskripsi (≤2000), kategori (`sparepart|oil|accessories|tools|other`), brand, part number, harga (1–100.000.000), diskon (`none|percent|fixed`), berat gram (1–50.000), stok (0–9.999), 1 foto utama (uploader bersama, file atau kamera).
**Aturan:** diskon percent 1–90, fixed < harga; `final_price` dihitung otomatis; produk nonaktif atau stok 0 tidak bisa dibeli; produk yang pernah dipesan tidak dihapus permanen (nonaktifkan).
**AC:** perubahan harga hanya berlaku untuk order baru; stok tidak pernah negatif.

---

### F-25 — Menjelajah BengkelShop

**Alur:** menu **BengkelShop** (`/shop`) menampilkan produk aktif dari bengkel `active`, lintas bengkel — bukan katalog satu bengkel. Filter: jenis bengkel, kategori, rentang harga, kata kunci; sort: terbaru, harga, rating. Kartu menampilkan foto, judul, harga (coret bila diskon), bengkel + jarak (jika lokasi diketahui), rating, stok.
**Aturan:** customer memilih sendiri item yang mau dibeli; produk stok 0 tampil "Out of stock" dan tidak bisa ditambahkan; klik produk membuka drawer detail (deskripsi, berat, bengkel, review, qty, add to cart).
**AC:** produk dari bengkel suspended tidak tampil; filter & sort konsisten dengan pagination; setiap kartu tetap menunjukkan bengkel penjual.

---

### F-26 — Cart Lintas Bengkel

**Alur:** add product → item masuk ke cart bengkel asal produk (satu cart internal per pasangan customer–bengkel). Halaman `/cart` menampilkan semua cart sekaligus, dikelompokkan per bengkel dengan subtotal masing-masing; tidak ada dialog ganti bengkel dan cart bengkel lain tidak dikosongkan.
**Aturan:** qty 1–stok; ubah/hapus item mencari cart yang memuat item tersebut; harga mengikuti harga saat ini (bukan snapshot) sampai checkout; cart kosong per bengkel otomatis hilang; tombol hapus tersedia per bengkel dan untuk semua bengkel; cart kosong total menampilkan CTA.
**AC:** produk dari beberapa bengkel bisa berada di cart pada saat yang sama; cart tidak pernah mencampur item ke bengkel yang salah; item nonaktif ditandai dan harus dihapus sebelum checkout.

---

### F-27 — Checkout

**Alur:** review item + subtotal per bengkel → isi nomor telepon (default dari profil, wajib) → **untuk setiap bengkel** pilih `pickup` (gratis) atau `expedition` (kurir instan **GoSend** atau ekspedisi komersial JNE/J&T/SiCepat/AnterAja) → bila ada yang dikirim, isi satu alamat pengiriman (nama penerima, alamat, kota, kode pos) yang dipakai untuk semua bengkel → pilih metode (VA/transfer/QRIS) → buat order.
**Aturan:** setiap bengkel menjadi **satu order terpisah** dengan fulfillment dan ongkirnya sendiri; validasi ulang stok & status produk per cart dalam transaksi; stok dipotong saat order dibuat; order `pending_payment` dengan `expires_at = now + 60 menit`; `pickup_code` 6 karakter unik (selalu dibuat, hanya dipakai pickup); **ongkir** = base tarif kurir + tarif/kg di atas batas inklusif (komersial: 1 kg lalu Rp6.000/kg; GoSend: 5 kg lalu Rp5.000/kg) berdasarkan total `weight_grams × qty` cart bengkel itu; alamat wajib lengkap bila ada bengkel yang dikirim; semua item order harus milik bengkel order.
**Error:** stok berubah → `409 STOCK_CHANGED` + detail item; produk nonaktif → `409 PRODUCT_UNAVAILABLE`; alamat ekspedisi tidak lengkap → `400 INVALID_SHIPPING`; email belum verifikasi → `403`.
**AC:** satu order hanya satu bengkel; total per order = Σ(unit_price × qty) setelah diskon + ongkir bengkel itu; checkout multi-bengkel membuat N order dan customer diarahkan ke daftar order; order muncul di customer & bengkel dengan label pickup/delivery dan nama kurir yang benar.

---

### F-28 — Pembayaran Order

**Alur:** order dibuat → payment `pending` (simulasi lokal) → halaman instruksi (VA number/QR/transfer) + countdown → status dicek via polling/refetch → `paid` setelah **Simulasikan pembayaran**. Target produksi memakai Midtrans Core API + webhook bertanda tangan.
**Aturan:** fake provider menyediakan tombol simulasi di luar UI customer (dev only); Midtrans memakai Core API charge; webhook diverifikasi signature & idempotent; kedaluwarsa → `expired` + stok dikembalikan.
**AC:** customer tidak bisa membatalkan setelah `paid`; retry pembayaran membuat payment baru dan menutup yang lama; status tidak pernah mundur dari `paid`.

---

### F-29 — Fulfillment: Pickup & Ekspedisi

**Alur owner (pickup):** order `paid` → **Preparing** → **Ready** (notifikasi + pickup code terlihat) → customer datang → owner membuka order → masukkan pickup code → **Verify** → order `completed`.
**Alur owner (ekspedisi):** order `paid` → **Preparing** → **Ready** (notifikasi "siap dikirim", tanpa kode pickup) → owner mengirim paket → memasukkan **nomor resi / booking ID kurir** (GoSend atau ekspedisi komersial) → **Mark as shipped** → status `shipped` + notifikasi berisi resi → customer **Confirm received** → `completed`.
**Aturan:** verifikasi pickup hanya untuk `ready_for_pickup` **dan** `fulfillment = pickup`; order ekspedisi tidak bisa diverifikasi pickup (`409 INVALID_FULFILLMENT`); resi minimal 4 karakter dan wajib sebelum `shipped`; kode salah → `400 INVALID_PICKUP_CODE` (maks 5 percobaan/menit); kode case-insensitive; sukses mengisi `completed_at`.
**AC:** order `pending_payment` tidak bisa disiapkan; pickup code tidak bisa dipakai dua kali; resi tampil di customer & bengkel; review produk terbuka setelah `completed`.

---

### F-30 — Review Produk

**Alur:** di order `completed`, customer menilai per item (1–5 + komentar opsional 10–500 jika diisi) → agregat produk diperbarui.
**Aturan:** 1 review per item per order; tidak bisa mengubah setelah submit; item tanpa review tetap boleh.
**AC:** rating produk tampil di kartu & drawer; review tersembunyi tidak dihitung.

---

## 7. Review Bengkel

### F-31 — Review Bengkel

**Prasyarat:** service order `paid`; belum pernah direview.
**Alur:** pilih rating 1–5, tag opsional (fair_price, fast, honest, clean, friendly), komentar 10–500 → submit → agregat bengkel diperbarui → tampil publik dengan nama "Budi S.".
**Aturan:** review tidak bisa diedit/dihapus customer; bengkel tidak bisa menolak review.
**AC:** review ganda ditolak `409 ALREADY_REVIEWED`; review `hidden` tidak memengaruhi agregat.

### F-32 — Balasan Review

**Alur:** owner membalas sekali per review (10–1000 karakter); balasan tampil di bawah review; `replied_at` diisi.
**AC:** balasan kedua ditolak; balasan bisa diedit? — **tidak** di v1.

---

## 8. Chat & Notifikasi

### F-33 — Chat

**Alur:** customer membuka bengkel → **Chat** → conversation dibuat (unik per pasangan) → kirim teks (1-2000) dan/atau 1 gambar (sumber ≤12 MB, dikompresi di browser, progres terlihat) → lawan bicara melihat pesan saat thread di-refetch/dibuka → read receipt saat thread dibuka. Target produksi memakai Socket.IO untuk pengiriman realtime.
**Aturan:** bengkel hanya bisa memulai conversation ke customer yang punya booking/order dengannya; customer bisa ke mana pun; user tidak bisa menghapus pesan; tidak ada soft-delete oleh admin; indikator typing opsional; unread badge = jumlah pesan belum dibaca.
**AC:** pesan tersimpan sebelum dikirim via WS (tidak hilang saat offline); urutan pesan stabil; attachment tampil; rate limit 30 pesan/menit.

### F-34 — Notifikasi

**Kanal:** in-app (bell + halaman) + email.
**Matriks:**

| Event | Penerima | In-app | Email |
|---|---|---|---|
| Email verification / reset | user | – | ✅ |
| Booking requested | owner | ✅ | ✅ |
| Booking confirmed/declined/rescheduled | customer | ✅ | ✅ |
| Service started | customer | ✅ | – |
| Estimate approval needed | customer | ✅ | ✅ |
| Service completed (invoice) | customer | ✅ | ✅ |
| Service paid | owner | ✅ | ✅ |
| Order paid | owner | ✅ | ✅ |
| Order ready (pickup / to ship) | customer | ✅ | ✅ |
| Order shipped (resi) | customer | ✅ | ✅ |
| Order completed | owner | ✅ | – |
| Chat message (offline > 10 menit) | lawan bicara | ✅ | ✅ |
| Review reply | customer | ✅ | ✅ |
| Service reminder | customer | ✅ | ✅ |
| Workshop suspended | owner | ✅ | ✅ |

**Aturan:** email mengikuti `users.locale`; in-app bisa dibaca sekaligus; tidak ada notifikasi untuk aksi sendiri.

### F-35 — Reminder Service

**Alur:** cron harian 09.00 Asia/Jakarta → kendaraan dengan `last_service_at` lebih tua dari `reminder_months` **atau** selisih odometer ≥ `reminder_km` → kirim in-app + email → catat `reminder_logs` agar tidak berulang dalam siklus yang sama.
**AC:** maksimal 1 reminder per kendaraan per 30 hari; kendaraan tanpa service pernah → tidak diingatkan.

---

## 9. Laporan Bengkel

> Tidak ada peran admin. Semua laporan di bawah ini dibaca dari data bengkel milik akun yang login.

### F-36 — Laporan Pendapatan & Performa

**Alur:** owner membuka `/workshop/reports` → pilih periode 7/30/90 hari → melihat kartu **pendapatan jasa**, **pendapatan toko**, **total pendapatan**, **transaksi lunas**, lalu **layanan terlaris**, **produk terlaris**, **ringkasan rating**, dan **transaksi terbaru**.
**Aturan:** hanya menghitung service order `paid` dan order toko dengan `paid_at` pada periode; order `cancelled` tidak dihitung; pendapatan jasa memakai `final_total`, pendapatan toko memakai `total` (termasuk ongkir); item diagregasi dari snapshot nama & subtotal; rating hanya dari review `published`; semua query otomatis discope `workshop_id = milik owner`.
**AC:** owner tidak bisa melihat angka bengkel lain; periode mengubah semua kartu & daftar secara konsisten; empty state muncul bila belum ada transaksi lunas.

---

## 10. UX & Platform

### F-39 — i18n

Semua layar memakai `next-intl`; format tanggal via `Intl.DateTimeFormat(locale)`; mata uang `Intl.NumberFormat('id-ID')` + `Rp`; tidak ada teks Inggris hardcoded di komponen ID (dan sebaliknya). Namespace `uploads.*` mencakup label tombol, tahap progres, pesan kesalahan, dan kamera; parity key EN/ID dijaga.

### F-40 — State Wajib Setiap Layar

| State | Perilaku |
|---|---|
| Loading | Skeleton untuk list/kartu; spinner untuk aksi tombol (disable + label progress) |
| Uploading | Pratinjau lokal + progress bar bertahap (tahap + persen); aksi unggah lain disabled; gagal → pesan di dekat field tanpa menghapus gambar lama |
| Empty | Ilustrasi ringan + penjelasan + CTA relevan |
| Error | Pesan manusiawi + tombol retry; error validasi di dekat field |
| Unauthorized | Redirect login + `returnTo` |
| Forbidden | Halaman 403 dengan tautan kembali |
| Not found | 404 dengan pencarian |
| Offline | Banner "You're offline" + retry |

### F-41 — Upload Media (lintas fitur)

**Tujuan:** satu perilaku unggah untuk semua foto, sehingga tidak ada lagi field "URL gambar".

**Permukaan:** cover bengkel, galeri bengkel, foto montir, foto produk, foto kendaraan, foto pekerjaan service, dan lampiran chat.

**Sumber input:**
1. **Drag & drop** ke area upload (desktop).
2. **File picker** (`accept="image/jpeg,image/png,image/webp"`).
3. **Camera sheet** — `getUserMedia`, kamera belakang sebagai default, tombol ganti kamera, capture frame menjadi JPEG.

**Pipeline (klien):** validasi tipe & ukuran → baca file (progress) → decode → perkecil ke sisi terpanjang 1280 px → kompresi JPEG berulang sampai ≤340 KB → unggah via XHR (progress nyata) → finalisasi. Label tahap: Reading, Optimising, Uploading, Finishing, Uploaded.

**Normalisasi runtime lokal:** hasil kompresi diunggah ke `POST /api/uploads`, ditulis ke `public/uploads`, dan disajikan kembali lewat `GET /api/uploads/[name]` (route handler, karena `next start` tidak menyajikan file public yang ditambahkan setelah build). Respons `201 { url: "/api/uploads/<name>" }`. Bila storage read-only, klien menyimpan data URL inline.

**Aturan:**
- Ukuran sumber ≤12 MB; hanya JPG/PNG/WebP; hasil akhir selalu JPEG.
- Pratinjau lokal muncul segera; nilai field lama tidak berubah sampai unggah sukses.
- Gagal validasi/decode/jaringan → pesan terlokalisasi, gambar lama tetap.
- Kamera tidak tersedia atau izin ditolak → pesan + tombol "Choose a file instead"; tidak boleh berakhir di layar kosong.
- Storage tidak tersedia → klien menyimpan gambar inline (data URL) agar alur tetap selesai.
- Multi-upload berjalan berurutan dengan counter `Uploading photo n of m`; masing-masing foto punya progres.
- Ganti foto menimpa nilai (bukan menambah); hapus mengosongkan field.
- Progress bar memakai `role="progressbar"` + `aria-valuenow`; durasi minimum ~720 ms agar tahap terbaca.

**AC:**
- AC-41.1 Tidak ada input teks URL gambar di layar mana pun.
- AC-41.2 Progres menampilkan tahap dan persentase; aksi yang bertabrakan disabled selama unggah.
- AC-41.3 Izin kamera ditolak → fallback file picker tetap bisa menyelesaikan upload.
- AC-41.4 File salah tipe, >12 MB, atau gagal decode menghasilkan pesan yang benar dan tidak menghapus foto lama.
- AC-41.5 URL hasil unggah tampil setelah reload; galeri menghormati batas maksimum per fitur.
- AC-41.6 Multi-upload menampilkan counter per foto dan berhenti dengan pesan jelas saat salah satu gagal.

### F-42 — Tema & Presisi Visual

**Alur:** pengguna mengganti tema **Night Shift** (default) atau **Day Shift** dari header/profil → preferensi disimpan → seluruh layar memakai token yang sama.
**Aturan:** Night Shift memakai lime `#C8F751` di atas `#0A0C0B`; Day Shift memakai olive `#587300` di atas `#F3F1EA`. Heading Space Grotesk, body Inter. Tile aksen memakai `.chip-accent` (redup, tanpa halo neon). Home menampilkan satu panel berisi search dan empat kategori (**Motorcycle, Car, BengkelShop, Garage**) sebagai sel sama lebar dengan tile ikon 32 px; label tidak boleh terpotong. Panel "How it works" memakai badge netral, garis `line`, dan langkah bernomor.
**AC:**
- AC-42.1 Tidak ada horizontal scroll pada 360, 390, 1024, dan 1440 px di kedua tema.
- AC-42.2 Empat kategori Home sama lebar dan labelnya tidak terpotong di semua breakpoint.
- AC-42.3 Kontras teks dan kontrol memenuhi WCAG 2.1 AA di kedua tema.
- AC-42.4 Pilihan tema bertahan setelah reload.

---

## 11. Inventaris Layar

**Customer:** `/`, `/workshops`, `/workshops/[slug]`, `/workshops/[slug]/book`, `/shop` (BengkelShop), `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/bookings`, `/bookings/[id]`, `/vehicles`, `/vehicles/[id]`, `/chat`, `/chat/[id]`, `/notifications`, `/profile`, `/auth/*`. Rute ini juga dipakai Workshop Owner untuk kebutuhan pribadinya.
**Workshop:** `/workshop`, `/workshop/profile`, `/workshop/mechanics`, `/workshop/services`, `/workshop/products`, `/workshop/bookings`, `/workshop/bookings/[id]`, `/workshop/orders`, `/workshop/orders/[id]`, `/workshop/reviews`, `/workshop/chat`, `/workshop/reports`.

---

## 12. Aturan Validasi Ringkas

| Entitas | Field | Aturan |
|---|---|---|
| User | email | unik, maks 254, format valid |
| User | password | ≥8, huruf + angka |
| User | phone | `+62…`, 9–15 digit |
| Workshop | nama | 2–80 |
| Workshop | deskripsi | ≤2000 |
| Workshop | koordinat | lat −90..90, lng −180..180 |
| Vehicle | plat | 3–12, unik per customer |
| Vehicle | tahun | 1900..tahun depan |
| Vehicle | odometer | 0..2.000.000 |
| Service order | keluhan | 10–1000 |
| Service order | estimasi/final | 1..100.000.000 |
| Service item | qty | 1..99 |
| Product | judul | 3–120 |
| Product | harga | 1..100.000.000 |
| Product | diskon | percent 1–90; fixed < harga |
| Product | berat | 1..50.000 g |
| Product | stok | 0..9.999 |
| Review | rating | 1..5 |
| Review | komentar | 10..500 |
| Chat | body | 1..2000 |
| Chat | gambar | 1 per pesan, sumber ≤12 MB |
| Workshop | galeri | maks 6 foto |
| Service order | foto pekerjaan | maks 4 foto |
| Upload | file | jpg/png/webp, sumber ≤12 MB |
| Upload | hasil | JPEG, sisi terpanjang 1280 px, target ≤340 KB |

---

## 13. Traceability

| Fitur | PRD Story |
|---|---|
| F-01..F-06 | US-01..US-07 |
| F-07..F-12 | US-08..US-14 |
| F-13..F-15 | US-15..US-22 |
| F-16..F-23 | US-23..US-30 |
| F-24..F-30 | US-31..US-37 |
| F-31..F-32 | US-38..US-40 |
| F-33..F-35 | US-42..US-45 |
| F-36 | US-46..US-47 |
| F-39..F-40 | US-48..US-50 |
| F-41..F-42 | US-51..US-53 |
