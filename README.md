# OptikCerah — E-commerce Kacamata (Tugas Kuliah)

Website e-commerce untuk penjualan kacamata, aksesoris, dan pendukung. Frontend HTML/CSS/JS native, backend Node.js + Express, database PostgreSQL. Siap di-deploy ke Vercel.

> **Catatan penting soal requirement PHP:** tugas kuliah kamu awalnya minta HTML/CSS/JS/PHP. Karena PHP tidak berjalan native di Vercel (platform serverless untuk Node.js/static, bukan PHP), project ini dibangun pakai **Node.js + Express** sebagai gantinya, supaya bisa langsung online di Vercel. Kalau dosen/pembimbingmu mempermasalahkan ini, sampaikan saja alasannya — atau kabari aku, nanti bisa dibuatkan versi PHP terpisah untuk dijalankan lokal via XAMPP/Laragon khusus untuk keperluan submit.

## Struktur Project

```
optikcerah/
├── public/               # Semua file frontend (WAJIB di sini untuk Vercel)
│   ├── index.html        # Beranda + katalog produk
│   ├── product.html      # Detail produk
│   ├── cart.html         # Keranjang belanja (localStorage)
│   ├── login.html / signup.html
│   ├── checkout.html      # Alamat, ongkir, promo
│   ├── payment.html       # Timer 2 jam, pilih metode bayar
│   ├── orders.html        # Riwayat pesanan pelanggan
│   ├── admin/
│   │   ├── dashboard.html # Statistik & pendapatan
│   │   ├── products.html  # CRUD produk
│   │   └── orders.html    # Kelola status pesanan
│   ├── css/style.css
│   └── js/                # main.js (shared), admin.js
├── api/index.js          # Semua endpoint backend (Express)
├── lib/db.js, auth.js, seed.js
├── schema.sql              # Skema database PostgreSQL
└── server.js               # Entry point untuk development lokal
```

> **Kenapa ada folder `public/`?** Vercel punya fitur zero-config khusus untuk Express: begitu dia mendeteksi `api/index.js` sebagai Express app, SEMUA request (termasuk halaman HTML) otomatis dilempar ke function itu — kecuali file yang ditaruh di `public/`, itu satu-satunya folder yang di-serve sebagai static file. Kalau file frontend ditaruh di luar `public/`, hasilnya `Cannot GET /` karena Express nggak punya route buat halaman-halaman itu.

## 1. Setup Database (PostgreSQL via Neon — gratis)

1. Daftar di [neon.tech](https://neon.tech), buat project baru.
2. Salin **connection string** yang diberikan (format `postgresql://user:pass@host/db?sslmode=require`).
3. Jalankan isi file `schema.sql` di SQL editor Neon (atau psql) untuk membuat semua tabel.
4. (Opsional) isi data contoh dengan menjalankan seed script (lihat langkah 3 di bawah) — ini juga membuat akun demo admin & customer.

## 2. Setup Lokal

```bash
npm install
cp .env.example .env
# lalu isi DATABASE_URL dan JWT_SECRET di file .env
```

## 3. Isi Data Contoh (Seed)

```bash
npm run seed
```
Ini akan menambahkan 10 produk contoh, 2 kode promo, dan 2 akun demo:
- **Admin**: `admin@optikcerah.com` / `admin123`
- **Customer**: `customer@optikcerah.com` / `customer123`

## 4. Jalankan Lokal

```bash
npm run dev
```
Buka `http://localhost:3000`.

## 5. Deploy ke Vercel

1. Push project ini ke repository GitHub.
2. Buka [vercel.com](https://vercel.com) → New Project → import repo tersebut.
3. Di bagian **Environment Variables**, tambahkan:
   - `DATABASE_URL` = connection string Neon kamu
   - `JWT_SECRET` = string rahasia bebas (panjang & acak)
4. Deploy. Vercel otomatis mendeteksi `api/index.js` sebagai Express app (zero-config) dan menyajikan semua file di dalam folder `public/` sebagai static assets.
5. Setelah live, kunjungi domain Vercel kamu — pastikan sudah menjalankan `schema.sql` dan seed di database produksi (jalankan `npm run seed` dari lokal dengan `DATABASE_URL` diarahkan ke database produksi).

## Alur Aplikasi

**Pelanggan:**
Lihat katalog (tanpa login) → tambah ke keranjang → login/daftar saat checkout → isi alamat, pilih ongkir, kode promo → pilih metode bayar → bayar dalam 2 jam (QRIS/VA/Kredit-Debit/Transfer, disimulasikan) → klik "Saya Sudah Bayar" → bisa keluar & cek status kapan saja di "Pesanan Saya" → saat status "Dikirim", klik "Barang Diterima".

**Status pesanan:** `pending_payment` → `paid` → `processing` → `shipped` → `received` (atau `expired` jika lewat 2 jam tanpa bayar).

**Admin:**
Login sebagai admin → Dasbor (lihat total pendapatan dari pesanan `received` + daftar yang perlu dikirim) → Pesanan (klik "Barang Diproses" lalu "Barang Dikirim") → Produk (tambah/edit/hapus produk).

## Catatan Teknis

- Autentikasi pakai JWT disimpan di httpOnly cookie (aman dari akses JavaScript/XSS).
- Keranjang belanja disimpan di `localStorage` browser (belum login), baru dikirim ke server saat checkout.
- Ongkos kirim: flat rate per kota (daftar kota ada di `api/index.js`, gampang ditambah/diubah).
- Timer pembayaran 2 jam dihitung dari `expires_at` di database; jika pelanggan membuka lagi setelah lewat waktu, sistem otomatis menandai pesanan `expired`.
- Ini project untuk tugas kuliah — metode pembayaran (QRIS, VA, dll) semuanya **simulasi**, tidak terhubung ke payment gateway sungguhan.
