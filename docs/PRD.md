# PRD — IndoBengkel v1.0

| Field | Value |
|---|---|
| Produk | IndoBengkel |
| Versi dokumen | 1.2 (23 Oktober 2026) |
| Status | MVP lokal terintegrasi — FE Next.js + NestJS API + PostgreSQL berjalan via Docker Compose |
| Pemilik | Product Owner (kamu) |
| Acuan | `SPEC.md` v1.0, `design/README.md` |
| Bahasa produk | English (default) + Indonesian |
| Runtime demo | Next.js 15 + NestJS 11 + PostgreSQL 16 + Prisma; mode mock tetap tersedia |

---

## 1. Ringkasan Eksekutif

IndoBengkel adalah web app yang mempertemukan pemilik kendaraan dengan bengkel motor/mobil: mencari bengkel terdekat, booking service, membeli produk lewat **BengkelShop** (ambil sendiri di bengkel atau dikirim ekspedisi), melihat riwayat service kendaraan, memberi rating, dan berchat ria dengan bengkel.

MVP ini dirancang sebagai **demo end-to-end dengan arsitektur siap produksi**: seluruh alur bisa dijalankan lewat `docker compose up` tanpa key eksternal (pembayaran fake, email lokal), dengan data seed yang cukup agar dashboard bengkel tidak terasa kosong.

Runtime yang berjalan sekarang adalah **Next.js 15 + NestJS 11 + PostgreSQL 16 + PostGIS 3.4 + Prisma**, diorkestrasi Docker Compose. Auth memakai cookie sesi `httpOnly` dan tabel `sessions`; seluruh alur customer dan konsol bengkel memanggil `/api/v1`. Data seed berisi 24 bengkel (23 aktif), 30 user, 372 layanan, 72 montir, 120 produk, 40 service order, 12 order, dan 84 review. FE juga masih menyediakan **mode mock** (`NEXT_PUBLIC_USE_MOCK_API=true`) untuk demo tanpa backend. Pembayaran masih simulasi, chat memakai polling/refetch, dan upload disimpan di disk lokal — Midtrans, MinIO/S3, Mailpit, dan Socket.IO tetap menjadi target produksi dan belum dijalankan.

Semua foto di produk ini **diunggah**, bukan ditempel sebagai URL: pengguna memilih file dari perangkat atau mengambil foto langsung dari kamera, gambar dikompresi di browser, dan progres unggah selalu terlihat.

Yang membedakan dari direktori bengkel biasa: **riwayat service terverifikasi** (hanya lahir dari service order yang dikonfirmasi bengkel), **estimasi vs invoice dengan approval otomatis di atas 150%**, **checklist pekerjaan per item** (setiap part yang diganti terlihat), dan **BengkelShop** yang mengumpulkan produk dari banyak bengkel dengan pengiriman ekspedisi.

**Satu bengkel, satu konsol.** Tidak ada peran platform-admin. Setiap akun bengkel hanya melihat dan mengelola bengkelnya sendiri — termasuk laporan keuangannya. Customer melihat banyak bengkel lewat discovery dan BengkelShop.

---

## 2. Latar Belakang & Masalah

Pemilik kendaraan di Indonesia menghadapi tiga friksi utama:

1. **Sulit menemukan bengkel yang tepat.** Pencarian berbasis teks tidak menunjukkan jarak, status buka, jenis kendaraan yang dilayani, atau reputasi.
2. **Riwayat service hilang.** Catatan service ada di buku manual, nota kertas, atau chat WhatsApp yang tertimbun. Saat mobil dijual atau pindah bengkel, riwayatnya tidak terbawa.
3. **Harga dan pekerjaan tidak transparan.** Customer tidak tahu estimasi di awal, lalu menghadapi tagihan yang membengkak tanpa persetujuan.

Di sisi bengkel:

1. Sulit mendapatkan customer baru di luar radius dan mulut ke mulut.
2. Tidak punya kanal untuk menjual stok sparepart/oli, sehingga stok mati.
3. Tidak punya data kepuasan pelanggan yang terukur; feedback hanya dari obrolan.

---

## 3. Tujuan & Non-Tujuan

### 3.1 Tujuan (v1)

| ID | Tujuan | Ukuran |
|---|---|---|
| G1 | Customer dapat menemukan bengkel terdekat yang sesuai jenis kendaraannya | Pencarian mengembalikan hasil berjarak benar, urut terdekat |
| G2 | Customer dapat memesan service dan menerima riwayat digital | Service order selesai menghasilkan riwayat + odometer |
| G3 | Customer dapat membeli produk bengkel dan memilih ambil sendiri atau dikirim ekspedisi | Checkout → bayar → pickup code / nomor resi → selesai |
| G4 | Bengkel dapat mengelola operasionalnya tanpa bantuan tim teknis | CRUD profil, montir, layanan, produk, order, chat, laporan |
| G5 | Transparansi harga | Estimasi saat konfirmasi; invoice >150% wajib approval; checklist item berharga |
| G6 | Komunikasi dua arah | Chat realtime dengan riwayat pesan |
| G7 | Dapat didemokan tanpa ketergantungan vendor | Semua alur jalan dengan fake payment + Mailpit |
| G8 | Laporan hanya untuk bengkel sendiri | Pendapatan jasa + produk, transaksi, layanan/produk terlaris, rating |
| G9 | Media masuk tanpa URL | Semua field foto menerima file atau kamera, terkompresi, progres terlihat; sumber ≤12 MB |

### 3.2 Non-tujuan (v1)

- Refund, pembatalan setelah bayar, dan sengketa uang.
- Payout otomatis ke rekening bengkel.
- Multi-cabang, multi-bahasa selain EN/ID, multi-currency.
- Login montir, aplikasi native, AI chatbot, loyalty, iklan.
- Peran/platform admin, moderasi konten global, dan visibilitas ke bengkel lain.
- Integrasi kurir resmi (API JNE/J&T/SiCepat): ongkir dihitung lokal, resi diinput manual.

---

## 4. Persona

### 4.1 Rina — Customer (28, karyawan, Jakarta)

- Punya 1 motor harian dan 1 mobil keluarga.
- Mencari bengkel lewat Google Maps, sering ke tempat yang sama karena malas mencoba.
- Ingin tahu: dekat tidaknya, buka atau tutup, harga wajar atau tidak, dan apakah pekerjaannya jujur.
- Ingin riwayat service mobil tersimpan agar bisa ditunjukkan saat menjual.
- Mobile-first; chat adalah kanal favoritnya.

**Kebutuhan utama:** temukan → percaya → booking → bayar → ambil → review.

### 4.2 Pak Andi — Pemilik bengkel (45, Bandung)

- Bengkel motor dengan 4 montir, buka 08.00–17.00, tutup Minggu.
- Mencatat service di buku, order sparepart lewat WhatsApp.
- Tidak mau ribet; desktop di kantor adalah perangkat utamanya.
- Ingin tahu: berapa pelanggan bulan ini, seberapa puas mereka, stok mana yang perlu dibeli.

**Kebutuhan utama:** profil tampil → terima booking → kerjakan → catat → dibayar → jaga reputasi.

### 4.3 Batas peran (penting)

Produk ini **tidak memiliki peran admin platform**. Yang ada hanya dua peran:

- **Customer** — mobile-first: discovery, booking, BengkelShop, garasi, chat, notifikasi.
- **Workshop owner/manager** — desktop-first: satu bengkel saja (profil, montir, layanan, produk, booking, service order, order toko, review, chat, laporan). Pemilik juga bisa memakai semua fitur customer (garasi, booking di bengkel lain, belanja, chat, review) untuk kebutuhan pribadinya.

Konsol bengkel tidak punya menu untuk melihat bengkel lain, dan laporan keuangan selalu discope ke bengkel pemilik akun. Moderasi konten global tidak termasuk v1; bengkel hanya bisa membalas review sekali dan tidak bisa mengubah/menghapusnya.

---

## 5. Jobs To Be Done

| JTBD | Persona | Terpenuhi oleh |
|---|---|---|
| "Saat motorku mogok, aku ingin menemukan bengkel buka terdekat." | Rina | Pencarian geo + status buka |
| "Saat aku mau service rutin, aku ingin memesan slot tanpa antre." | Rina | Booking + kapasitas slot |
| "Saat bengkel menemukan kerusakan tambahan, aku ingin menyetujuinya dulu." | Rina | Estimasi + approval >150% |
| "Saat aku menjual mobil, aku ingin menunjukkan riwayat servisnya." | Rina | Riwayat + odometer per kendaraan |
| "Saat aku butuh oli, aku ingin membelinya dari bengkel langgananku." | Rina | BengkelShop + ambil sendiri/kirim |
| "Saat pelanggan booking, aku ingin tahu siapa, kendaraan apa, dan keluhannya." | Pak Andi | Dashboard booking |
| "Saat pekerjaan selesai, aku ingin menagih dengan rincian yang jelas." | Pak Andi | Finish service + invoice |
| "Saat pelanggan bertanya, aku ingin membalas cepat." | Pak Andi | Chat realtime |

---

## 6. Ruang Lingkup

### 6.1 In scope

| Modul | Isi |
|---|---|
| Akun & auth | Registrasi customer/bengkel, verifikasi email, login, logout, refresh, reset password, sesi multi-device |
| Bengkel | Profil, tipe (motor/mobil), alamat + koordinat, jam buka, closure, foto cover + galeri (upload/kamera), montir (termasuk foto), katalog layanan |
| Discovery | Pencarian terdekat, radius, filter jenis, buka sekarang, rating, kata kunci, peta + list |
| Kendaraan | CRUD kendaraan (termasuk foto), riwayat service, reminder |
| Booking | Pilih slot, keluhan, odometer awal, konfirmasi/tolak, pembatalan, no-show |
| Service order | Start/finish, montir, item jasa/part, foto pekerjaan (upload/kamera, maks 4), catatan, invoice, approval, pembayaran online/cash |
| Shop | **BengkelShop** marketplace lintas bengkel, stok, diskon, berat, foto produk (upload/kamera), cart lintas bengkel (satu order per bengkel), checkout pickup/GoSend/ekspedisi + resi |
| Pembayaran | Fake provider (lokal), Midtrans (sandbox/prod), VA/transfer/QRIS, webhook |
| Review | Rating bengkel & produk, tag, balasan bengkel sekali, tanpa edit/hapus |
| Chat | Thread per pasangan, teks + 1 gambar (upload, progres), read receipt, unread, realtime |
| Notifikasi | In-app + email EN/ID, reminder service |
| Laporan | Pendapatan jasa + toko, transaksi lunas, layanan/produk terlaris, rating — hanya bengkel sendiri |
| Media | Satu pipeline unggah untuk semua foto: drag & drop, file picker, kamera, kompresi klien, progres per tahap, fallback saat storage tidak tersedia |
| Platform | i18n EN/ID, Night Shift (default) + Day Shift, layout presisi 360 px, Docker compose, seed |

### 6.2 Out of scope

Lihat §3.2. Secara teknis sudah dinyatakan juga di `SPEC.md` §14.

---

## 7. User Journey

### 7.1 Customer — service

1. Buka web → izinkan lokasi (atau cari "Bandung").
2. Lihat bengkel terdekat: jarak, rating, buka/tutup, foto, jenis.
3. Buka bengkel → pilih kendaraan → pilih layanan → pilih slot → isi keluhan & odometer → kirim booking.
4. Terima email/notifikasi "booking dikonfirmasi" beserta estimasi.
5. Datang; bengkel menekan **Start** dan mencatat odometer.
6. Jika ada temuan tambahan dan invoice >150% estimasi, customer menerima notifikasi approval → setuju/tolak.
7. Bengkel **Finish**; customer menerima invoice → bayar online atau cash.
8. Riwayat muncul di kendaraan; customer memberi rating.

### 7.2 Customer — belanja (BengkelShop)

1. Buka menu **BengkelShop** → lihat produk dari banyak bengkel, filter kategori/jenis bengkel/rating/harga → buka produk.
2. Tambah ke cart; cart boleh berisi produk dari beberapa bengkel sekaligus (dikelompokkan per bengkel).
3. Checkout → **untuk setiap bengkel** pilih **ambil di bengkel** atau **kirim** (GoSend instan atau JNE/J&T/SiCepat/AnterAja, alamat + ongkir dihitung per bengkel) → pilih VA/transfer/QRIS → satu order per bengkel dibuat.
4. Bengkel menyiapkan → **Ready**. Untuk pickup: pickup code. Untuk pengiriman: bengkel memasukkan nomor resi / booking ID → status **Shipped**.
5. Customer menerima barang → konfirmasi diterima (pengiriman) atau petugas verifikasi kode (pickup) → selesai → review produk.

### 7.3 Bengkel (satu bengkel per akun)

1. Registrasi → verifikasi email → lengkapi profil (wajib: nama, tipe, alamat + koordinat, jam buka, cover) → tayang otomatis.
2. Kelola montir (dengan foto), layanan (checklist item berharga), produk (dengan foto) — semua foto diunggah dari file atau kamera.
3. Terima booking → konfirmasi + estimasi → Start → Finish dengan checklist pekerjaan dan foto (maks 4) → invoice.
4. Terima order toko → Preparing → Ready → verifikasi pickup **atau** input resi untuk ekspedisi.
5. Balas chat & review; pantau dashboard dan **laporan bengkel sendiri**. Tidak ada akses ke bengkel lain.

---

## 8. Epics & User Stories

Prioritas: **M** = Must, **S** = Should, **C** = Could (v1 hanya M/S).

### E1 — Akun & Autentikasi

| ID | Story | Prio |
|---|---|---|
| US-01 | Sebagai customer, saya bisa mendaftar dengan email, password, nama, dan nomor telepon. | M |
| US-02 | Sebagai pemilik bengkel, saya bisa mendaftar dengan data akun + data bengkel. | M |
| US-03 | Sebagai pengguna, saya harus memverifikasi email sebelum bertransaksi. | M |
| US-04 | Sebagai pengguna, saya bisa login dan tetap login di beberapa perangkat. | M |
| US-05 | Sebagai pengguna, saya bisa logout dari perangkat ini atau semua perangkat. | M |
| US-06 | Sebagai pengguna, saya bisa mereset password lewat email. | M |
| US-07 | Sebagai pengguna, saya bisa mengganti bahasa antarmuka EN/ID. | S |

### E2 — Profil Bengkel

| ID | Story | Prio |
|---|---|---|
| US-08 | Sebagai pemilik, saya bisa mengisi nama, deskripsi, tipe bengkel (motor/mobil), telepon. | M |
| US-09 | Sebagai pemilik, saya bisa menandai lokasi bengkel di peta atau mencari alamat. | M |
| US-10 | Sebagai pemilik, saya bisa mengatur jam buka per hari dan tanggal tutup. | M |
| US-11 | Sebagai pemilik, saya bisa mengunggah cover dan galeri dari perangkat atau kamera. | M |
| US-12 | Sebagai pemilik, saya bisa mengelola montir: nama, telepon, pengalaman, keahlian, foto. | M |
| US-13 | Sebagai pemilik, saya bisa mengelola katalog layanan: nama, harga, durasi. | M |
| US-14 | Sebagai pemilik, saya bisa melihat dashboard kepuasan & operasional. | M |

### E3 — Discovery

| ID | Story | Prio |
|---|---|---|
| US-15 | Sebagai customer, saya bisa membagikan lokasi atau mencari lokasi manual. | M |
| US-16 | Sebagai customer, saya melihat bengkel urut terdekat dengan jarak, rating, status buka, foto. | M |
| US-17 | Sebagai customer, saya bisa memfilter jenis bengkel, buka sekarang, rating minimum. | M |
| US-18 | Sebagai customer, saya bisa melihat detail bengkel: layanan, produk, montir, review, jam buka. | M |

### E4 — Kendaraan

| ID | Story | Prio |
|---|---|---|
| US-19 | Sebagai customer, saya bisa menambah kendaraan (jenis, merek, model, tahun, plat, odometer awal). | M |
| US-20 | Sebagai customer, saya bisa mengubah/menghapus kendaraan (hapus hanya jika belum ada service). | M |
| US-21 | Sebagai customer, saya bisa melihat riwayat service per kendaraan. | M |
| US-22 | Sebagai customer, saya menerima reminder service berkala. | S |

### E5 — Booking & Service

| ID | Story | Prio |
|---|---|---|
| US-23 | Sebagai customer, saya bisa memesan slot pada bengkel yang sesuai jenis kendaraan saya. | M |
| US-24 | Sebagai pemilik, saya bisa konfirmasi/tolak booking dengan estimasi biaya. | M |
| US-25 | Sebagai customer, saya bisa membatalkan booking (bebas sampai 2 jam sebelum slot). | M |
| US-26 | Sebagai pemilik, saya bisa Start service: odometer dan montir. | M |
| US-27 | Sebagai pemilik, saya bisa Finish service: item, foto (maks 4), catatan, invoice. | M |
| US-28 | Sebagai customer, saya harus menyetujui invoice yang melebihi 150% estimasi. | M |
| US-29 | Sebagai customer, saya bisa membayar service online atau memilih cash di bengkel. | M |
| US-30 | Sebagai pemilik, saya bisa menandai no-show. | S |

### E6 — BengkelShop

| ID | Story | Prio |
|---|---|---|
| US-31 | Sebagai pemilik, saya bisa menambah produk: judul, deskripsi, harga, diskon, berat, stok, foto (upload/kamera). | M |
| US-32 | Sebagai customer, saya bisa menjelajah produk lintas bengkel lewat menu BengkelShop dan memfilter. | M |
| US-33 | Sebagai customer, saya bisa menaruh produk dari beberapa bengkel dalam satu cart. | M |
| US-34 | Sebagai customer, saya bisa checkout beberapa bengkel sekaligus dan memilih fulfillment per bengkel. | M |
| US-35 | Sebagai customer, saya bisa membayar dengan VA, transfer bank, atau QRIS. | M |
| US-35a | Sebagai customer, saya bisa memilih ambil di bengkel atau kirim via ekspedisi dengan alamat dan ongkir. | M |
| US-36 | Sebagai pemilik, saya bisa menyiapkan order dan menandainya siap. | M |
| US-37 | Sebagai pemilik, saya bisa memverifikasi pickup code di layar. | M |
| US-37a | Sebagai pemilik, saya bisa memasukkan nomor resi dan menandai order ekspedisi sebagai shipped. | M |
| US-37b | Sebagai customer, saya bisa mengonfirmasi barang ekspedisi sudah diterima. | M |

### E7 — Review

| ID | Story | Prio |
|---|---|---|
| US-38 | Sebagai customer, saya bisa menilai bengkel setelah service dibayar. | M |
| US-39 | Sebagai customer, saya bisa menilai produk setelah order selesai. | M |
| US-40 | Sebagai pemilik, saya bisa membalas review sekali. | M |

### E8 — Chat & Notifikasi

| ID | Story | Prio |
|---|---|---|
| US-42 | Sebagai customer, saya bisa memulai chat dengan bengkel mana pun. | M |
| US-43 | Sebagai pemilik, saya bisa membalas customer yang punya transaksi dengan bengkel saya. | M |
| US-44 | Sebagai pengguna, saya melihat pesan baru realtime + unread badge. | M |
| US-45 | Sebagai pengguna, saya menerima notifikasi in-app dan email untuk event penting. | M |

### E9 — Laporan & Platform

| ID | Story | Prio |
|---|---|---|
| US-46 | Sebagai pemilik, saya bisa melihat laporan pendapatan jasa & toko bengkel saya per periode. | M |
| US-47 | Sebagai pemilik, saya bisa melihat layanan/produk terlaris dan ringkasan rating. | M |
| US-48 | Sebagai pengguna, saya bisa memakai seluruh UI dalam EN atau ID. | M |
| US-49 | Sebagai pengguna, saya bisa memakai aplikasi di ponsel 360px tanpa horizontal scroll. | M |
| US-50 | Sebagai pengguna, saya bisa melihat status kosong/loading/error yang jelas di setiap layar. | M |

### E10 — Media & Tampilan

| ID | Story | Prio |
|---|---|---|
| US-51 | Sebagai pengguna, saya bisa memilih foto dari perangkat atau mengambil foto langsung dari kamera, lalu melihat progres unggah yang jelas. | M |
| US-52 | Sebagai pengguna, saya tidak perlu menempel URL gambar di field mana pun. | M |
| US-53 | Sebagai pengguna, saya bisa memakai tema Night Shift atau Day Shift dengan layout tetap rapi tanpa horizontal scroll di 360 px. | M |

---

## 9. Kebutuhan Non-Fungsional

| Kategori | Target v1 |
|---|---|
| Performa | Pencarian bengkel p95 < 300 ms (10k bengkel seed), halaman list p95 < 2.5 s TTI di 4G |
| Real-time | Pesan terkirim < 300 ms pada koneksi normal |
| Keamanan | Argon2id, JWT 15 m + refresh rotation, CSRF, rate limit, otorisasi per resource, upload tervalidasi (MIME, ukuran, nama acak) + kepemilikan file |
| Media | Sumber ≤12 MB; kompresi klien ke sisi terpanjang 1280 px dengan target output ≤340 KB; progres per tahap; kamera dengan fallback file picker |
| Aksesibilitas | WCAG 2.1 AA untuk kontras di kedua tema, fokus keyboard, label form, ukuran target sentuh ≥ 44px |
| Kompatibilitas | Chrome/Edge/Firefox/Safari 2 versi terakhir; iOS Safari & Android Chrome |
| Responsif | Customer 360px+ (grid kategori Home 4 kolom sama lebar), bengkel 1024px+ |
| i18n | 100% string UI/email/notifikasi punya terjemahan EN & ID; tidak ada string hardcoded |
| Observability | Log terstruktur + request id; `/health` & `/health/ready` |
| Data | Seed deterministik; migrasi Prisma reversible; backup tidak termasuk MVP |
| Privasi | Bengkel hanya melihat data customer yang bertransaksi dengannya |

---

## 10. Metrik Keberhasilan MVP

1. **Flow completion:** 6 alur utama (register, booking→service→pay, BengkelShop→bayar→pickup, BengkelShop→bayar→ekspedisi→resi→diterima, chat, review) lulus uji manual & Playwright tanpa intervensi DB.
2. **Seed realism:** 24 bengkel, 120 produk, 40 service order, ≥ 60 review; dashboard bengkel menampilkan rating & pendapatan.
3. **i18n:** 0 string hardcoded (dicek lint/scan), toggle EN↔ID tidak merusak layout.
4. **Latency:** pencarian < 300 ms p95 pada dataset seed.
5. **Security:** tidak ada temuan kritis dari checklist IDOR/XSS/CSRF/upload; semua endpoint terotorisasi.
6. **Cold start:** `docker compose up` + migrate + seed berhasil di mesin bersih tanpa langkah manual di luar README.
7. **Demo:** 1 skrip demo 10 menit berjalan tanpa error konsol.
8. **Media:** semua field foto (cover, galeri, montir, produk, kendaraan, service, chat) bisa diisi lewat file atau kamera, menampilkan progres, dan tetap tersimpan setelah reload.

---

## 11. Asumsi & Ketergantungan

| ID | Asumsi |
|---|---|
| A1 | Operasional Indonesia; semua harga IDR; waktu tampil mengikuti timezone bengkel |
| A2 | Customer punya browser modern dengan geolocation (opsional; pencarian manual selalu tersedia) |
| A3 | Bengkel mengakses web dari desktop/tablet; verifikasi pickup dilakukan di layar |
| A4 | Tidak ada komisi platform di v1; uang masuk ke platform lalu payout manual di luar aplikasi |
| A5 | Midtrans sandbox tersedia saat fase 5; sebelum itu fake provider dipakai |
| A6 | Tidak ada refund; order paid wajib dipenuhi (kegagalan ditangani manual, di luar aplikasi) |
| A7 | Bengkel tayang tanpa approval; kualitas dijaga lewat report + suspend |
| A8 | Tidak ada login montir; montir adalah data yang dikelola pemilik |
| A9 | Satu bengkel satu lokasi; ekspansi cabang ditunda |
| A10 | Tile OSM publik cukup untuk demo |
| A11 | Runtime lokal memakai NestJS + PostgreSQL; mode mock `localStorage` dipertahankan hanya sebagai fallback demo FE |
| A12 | Upload lokal menulis ke `public/uploads` dan disajikan lewat `GET /api/uploads/[name]`; bila storage read-only, klien menyimpan gambar inline sebagai data URL |

---

## 12. Risiko Produk

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tanpa refund | Kepercayaan customer turun; sengketa tak punya jalur | Dijelaskan di UI sebelum bayar; prosedur manual; prioritas pasca-MVP |
| Tanpa approval bengkel | Bengkel fiktif/spam | Verifikasi email + status draft/active/suspended yang dikelola bengkel sendiri |
| Data seed tidak meyakinkan | Demo terasa kosong | Seed kaya + gambar lokal + review realistis |
| Estimasi vs invoice | Sengketa harga | Approval >150% + checklist item transparan |
| Pickup code ditebak | Barang salah ambil | 6 karakter acak, verifikasi petugas, order harus `ready_for_pickup` & fulfillment pickup |
| Resi salah/tidak diisi | Customer tidak bisa melacak | Resi wajib sebelum `shipped`; customer konfirmasi diterima; notifikasi otomatis |
| Chat spam | Pengalaman buruk | Bengkel hanya bisa memulai chat ke customer bertransaksi + rate limit |
| Bengkel suspended saat ada order aktif | Order menggantung | Order tetap bisa diselesaikan; bengkel tidak muncul di pencarian & tidak bisa terima order baru |
| Timezone | Slot meleset | Simpan UTC; semua kalkulasi slot memakai `workshops.timezone` |
| Field gambar berupa URL | Pengguna tidak bisa memasukkan foto asli; data mudah basi | Uploader seragam (file + kamera) dengan kompresi dan progres |
| Storage demo read-only | Upload gagal saat deploy | Fallback data URL inline + pesan jelas; produksi memakai S3/MinIO |
| Kuota `localStorage` saat fallback mock | Data demo gagal disimpan | Mode utama memakai PostgreSQL; `saveDb` mock melaporkan error kuota |
| Tema terang kehilangan kontras | UI tidak terbaca | Token Day Shift olive diuji kontras AA |
| Spasi kategori Home tidak presisi | UI terasa amatir | Grid 4 kolom sama lebar + `.chip-accent`; diuji 360–1440 px |

---

## 13. Release Criteria (Definition of Done MVP)

- [ ] Semua US berprioritas **M** diterima.
- [ ] Semua acceptance criteria di FSD lulus.
- [ ] `docker compose up` bersih + seed berhasil dari nol.
- [ ] EN & ID lengkap untuk semua layar yang dirilis.
- [ ] Playwright lulus untuk 6 alur utama.
- [ ] Checklist keamanan lulus (IDOR, CSRF, rate limit, upload, webhook signature).
- [ ] Tidak ada error konsol di alur demo.
- [ ] Semua field foto memakai uploader yang sama (file + kamera) dengan progres; tidak ada input URL gambar.
- [ ] Night Shift dan Day Shift lulus kontras AA dan tidak menghasilkan horizontal scroll di 360 px.
- [ ] README berisi langkah jalan, akun seed, dan skrip demo.
- [ ] `SPEC.md`, `FSD.md`, `TSD.md`, `PLAN.md` diperbarui bila ada penyimpangan.

---

## 14. Glosarium

| Istilah | Arti |
|---|---|
| Workshop | Bengkel; satu akun = satu lokasi |
| Service order | Pesanan jasa service, dari booking sampai dibayar |
| Booking | Permintaan slot service sebelum dikonfirmasi |
| Estimasi | Perkiraan biaya yang diisi bengkel saat konfirmasi |
| Invoice final | Total akhir setelah pekerjaan selesai |
| Pickup code | Kode 6 karakter untuk verifikasi pengambilan barang |
| Slot | Satuan waktu 60 menit pada jam buka bengkel |
| BengkelShop | Marketplace lintas bengkel; cart lintas bengkel, satu order = satu bengkel |
| Fulfillment | Cara barang diterima: `pickup` (ambil di bengkel) atau `expedition` (GoSend instan atau ekspedisi komersial) |
| Resi / tracking | Nomor pelacakan atau booking ID kurir, diinput bengkel saat menandai `shipped` |
| Ongkir | Biaya kirim dihitung dari berat total dan ekspedisi terpilih |
| Laporan | Halaman pendapatan/transaksi/terlaris milik satu bengkel |
| Fake provider | Simulator pembayaran untuk lingkungan lokal |
| Night Shift | Nama design system (dark + lime) |
| Day Shift | Varian terang dari design system; aksen olive `#587300` |
| Upload pipeline | Alur baca → kompresi → unggah → selesai untuk satu gambar, dengan progres per tahap |
| Fallback inline | Gambar disimpan sebagai data URL ketika endpoint upload tidak tersedia (khusus demo) |
