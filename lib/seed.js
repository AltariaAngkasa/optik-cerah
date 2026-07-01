// Seed database dengan produk contoh + akun demo
// Jalankan: node lib/seed.js  (pastikan DATABASE_URL sudah di-set di .env)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const products = [
  { name: 'Aurora Round Sunglasses', category: 'kacamata', price: 349000, stock: 25, description: 'Kacamata hitam bulat dengan lensa polarized anti-UV, cocok untuk gaya sehari-hari.', image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800' },
  { name: 'Skyline Wayfarer', category: 'kacamata', price: 279000, stock: 40, description: 'Frame wayfarer klasik, ringan, dan tahan lama untuk pemakaian harian.', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800' },
  { name: 'Nimbus Minimalist Frame', category: 'kacamata', price: 399000, stock: 18, description: 'Frame minimalis titanium, super ringan, cocok untuk kacamata baca maupun anti radiasi.', image_url: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800' },
  { name: 'Horizon Aviator', category: 'kacamata', price: 429000, stock: 22, description: 'Aviator klasik dengan lapisan lensa anti-silau untuk berkendara.', image_url: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800' },
  { name: 'Cloud Blue-Light Glasses', category: 'kacamata', price: 259000, stock: 50, description: 'Kacamata anti radiasi blue-light, nyaman dipakai lama di depan layar.', image_url: 'https://images.unsplash.com/photo-1577803645773-f96470509666?w=800' },
  { name: 'Kacamata Case Premium', category: 'aksesoris', price: 89000, stock: 60, description: 'Hardcase pelindung kacamata dengan bahan kulit sintetis anti benturan.', image_url: 'https://images.unsplash.com/photo-1600091166971-7f9faad6c1e2?w=800' },
  { name: 'Lens Cleaning Kit', category: 'aksesoris', price: 45000, stock: 100, description: 'Kit pembersih lensa lengkap dengan cairan anti-fog dan lap microfiber.', image_url: 'https://images.unsplash.com/photo-1608889175638-9e3f68e6a6d5?w=800' },
  { name: 'Tali Kacamata Anti Slip', category: 'aksesoris', price: 35000, stock: 80, description: 'Strap kacamata anti slip, nyaman untuk aktivitas outdoor.', image_url: 'https://images.unsplash.com/photo-1587467512961-120760940315?w=800' },
  { name: 'Nose Pad Silicone Set', category: 'pendukung', price: 25000, stock: 120, description: 'Set nose pad silicone pengganti agar kacamata lebih nyaman di hidung.', image_url: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800' },
  { name: 'Obeng Mini Kacamata', category: 'pendukung', price: 20000, stock: 90, description: 'Obeng presisi untuk servis dan kencangkan sekrup kacamata di rumah.', image_url: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800' }
];

const promos = [
  { code: 'OPTIK10', discount_type: 'percent', discount_value: 10 },
  { code: 'HEMAT25K', discount_type: 'amount', discount_value: 25000 }
];

async function seed() {
  console.log('Seeding database...');

  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, category, price, stock, description, image_url) VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.name, p.category, p.price, p.stock, p.description, p.image_url]
    );
  }

  for (const promo of promos) {
    await pool.query(
      `INSERT INTO promo_codes (code, discount_type, discount_value) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING`,
      [promo.code, promo.discount_type, promo.discount_value]
    );
  }

  const adminHash = await bcrypt.hash('admin123', 10);
  const custHash = await bcrypt.hash('customer123', 10);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin') ON CONFLICT (email) DO NOTHING`,
    ['Admin OptikCerah', 'admin@optikcerah.com', adminHash]
  );
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'customer') ON CONFLICT (email) DO NOTHING`,
    ['Pelanggan Demo', 'customer@optikcerah.com', custHash]
  );

  console.log('Selesai! Akun demo:');
  console.log('  Admin    : admin@optikcerah.com / admin123');
  console.log('  Customer : customer@optikcerah.com / customer123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
