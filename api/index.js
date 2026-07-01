require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { pool } = require('../lib/db');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth, requireAdmin, optionalAuth } = require('../lib/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 jam

// Ongkos kirim flat rate per kota (contoh sederhana untuk tugas kuliah)
const SHIPPING_RATES = [
  { city: 'Bogor', cost: 12000 },
  { city: 'Jakarta', cost: 15000 },
  { city: 'Depok', cost: 13000 },
  { city: 'Tangerang', cost: 16000 },
  { city: 'Bekasi', cost: 16000 },
  { city: 'Bandung', cost: 20000 },
  { city: 'Surabaya', cost: 30000 },
  { city: 'Yogyakarta', cost: 25000 },
  { city: 'Semarang', cost: 25000 },
  { city: 'Medan', cost: 35000 },
  { city: 'Makassar', cost: 38000 },
  { city: 'Denpasar', cost: 30000 }
];

function genOrderCode() {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OC-${now}${rand}`;
}

function toNumber(v) { return Math.round(Number(v) * 100) / 100; }

// ---------- AUTH ----------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email sudah terdaftar. Silakan login.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, role) VALUES ($1,$2,$3,$4,'customer') RETURNING id, name, email, role`,
      [name, email.toLowerCase(), hash, phone || null]
    );
    const user = result.rows[0];
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mendaftar. Coba lagi.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Email atau password salah.' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Email atau password salah.' });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal login. Coba lagi.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', optionalAuth, (req, res) => {
  res.json({ user: req.user || null });
});

// ---------- PRODUCTS ----------
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = TRUE';
    const params = [];
    if (category && category !== 'semua') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND name ILIKE $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ products: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat produk.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id=$1 AND is_active=TRUE', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat produk.' });
  }
});

// ---------- SHIPPING ----------
app.get('/api/shipping/cities', (req, res) => {
  res.json({ cities: SHIPPING_RATES });
});

// ---------- PROMO ----------
app.post('/api/promo/check', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Kode promo kosong.' });
    const result = await pool.query('SELECT * FROM promo_codes WHERE code=$1 AND active=TRUE', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Kode promo tidak valid atau sudah tidak berlaku.' });
    res.json({ promo: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengecek kode promo.' });
  }
});

// ---------- ORDERS (customer) ----------
app.post('/api/orders', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { items, recipient_name, phone, address, city, postal_code, promo_code, payment_method } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang kosong.' });
    }
    if (!recipient_name || !phone || !address || !city) {
      return res.status(400).json({ error: 'Lengkapi data alamat pengiriman terlebih dahulu.' });
    }

    await client.query('BEGIN');

    let subtotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const pRes = await client.query('SELECT * FROM products WHERE id=$1 AND is_active=TRUE', [item.product_id]);
      if (pRes.rows.length === 0) throw new Error(`Produk tidak ditemukan (id ${item.product_id})`);
      const product = pRes.rows[0];
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      if (product.stock < qty) throw new Error(`Stok "${product.name}" tidak mencukupi.`);
      subtotal += Number(product.price) * qty;
      resolvedItems.push({ product_id: product.id, product_name: product.name, price: product.price, quantity: qty });
    }

    const shippingEntry = SHIPPING_RATES.find(c => c.city.toLowerCase() === String(city).toLowerCase());
    const shippingCost = shippingEntry ? shippingEntry.cost : 20000;

    let discount = 0;
    let promoCodeUsed = null;
    if (promo_code) {
      const promoRes = await client.query('SELECT * FROM promo_codes WHERE code=$1 AND active=TRUE', [promo_code.toUpperCase()]);
      if (promoRes.rows.length > 0) {
        const promo = promoRes.rows[0];
        discount = promo.discount_type === 'percent' ? subtotal * (Number(promo.discount_value) / 100) : Number(promo.discount_value);
        promoCodeUsed = promo.code;
      }
    }

    const total = Math.max(0, toNumber(subtotal + shippingCost - discount));
    const orderCode = genOrderCode();
    const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS);

    const orderRes = await client.query(
      `INSERT INTO orders (order_code, user_id, status, payment_method, subtotal, shipping_cost, discount, total, promo_code, recipient_name, phone, address, city, postal_code, expires_at)
       VALUES ($1,$2,'pending_payment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [orderCode, req.user.id, payment_method || null, toNumber(subtotal), shippingCost, toNumber(discount), total, promoCodeUsed, recipient_name, phone, address, city, postal_code || null, expiresAt]
    );
    const order = orderRes.rows[0];

    for (const it of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES ($1,$2,$3,$4,$5)`,
        [order.id, it.product_id, it.product_name, it.price, it.quantity]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id=$2', [it.quantity, it.product_id]);
    }

    await client.query('COMMIT');
    res.json({ order, items: resolvedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Gagal membuat pesanan.' });
  } finally {
    client.release();
  }
});

async function expireIfNeeded(order) {
  if (order.status === 'pending_payment' && new Date(order.expires_at) < new Date()) {
    await pool.query(`UPDATE orders SET status='expired' WHERE id=$1`, [order.id]);
    order.status = 'expired';
  }
  return order;
}

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    for (const order of result.rows) await expireIfNeeded(order);
    res.json({ orders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat riwayat pesanan.' });
  }
});

app.get('/api/orders/:code', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    const order = result.rows[0];
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Kamu tidak punya akses ke pesanan ini.' });
    }
    await expireIfNeeded(order);
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [order.id]);
    res.json({ order, items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat detail pesanan.' });
  }
});

app.post('/api/orders/:code/pay', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    let order = result.rows[0];
    if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Bukan pesananmu.' });
    await expireIfNeeded(order);
    if (order.status === 'expired') return res.status(400).json({ error: 'Waktu pembayaran sudah habis. Pesanan dibatalkan otomatis.' });
    if (order.status !== 'pending_payment') return res.status(400).json({ error: 'Pesanan ini sudah tidak menunggu pembayaran.' });

    const { payment_method } = req.body;
    const updateRes = await pool.query(
      `UPDATE orders SET status='paid', paid_at=NOW(), payment_method=COALESCE($2, payment_method) WHERE id=$1 RETURNING *`,
      [order.id, payment_method || null]
    );
    res.json({ order: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengonfirmasi pembayaran.' });
  }
});

app.post('/api/orders/:code/received', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    const order = result.rows[0];
    if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Bukan pesananmu.' });
    if (order.status !== 'shipped') return res.status(400).json({ error: 'Pesanan belum berstatus dikirim.' });
    const updateRes = await pool.query(
      `UPDATE orders SET status='received', received_at=NOW() WHERE id=$1 RETURNING *`, [order.id]
    );
    res.json({ order: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memperbarui status pesanan.' });
  }
});

// ---------- ADMIN ----------
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const revenueRes = await pool.query(`SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS count FROM orders WHERE status='received'`);
    const toShipRes = await pool.query(`SELECT COUNT(*) AS count FROM orders WHERE status IN ('paid','processing')`);
    const shippedRes = await pool.query(`SELECT COUNT(*) AS count FROM orders WHERE status='shipped'`);
    const totalOrdersRes = await pool.query(`SELECT COUNT(*) AS count FROM orders`);
    res.json({
      revenue: Number(revenueRes.rows[0].revenue),
      receivedOrders: Number(revenueRes.rows[0].count),
      pendingToShip: Number(toShipRes.rows[0].count),
      inTransit: Number(shippedRes.rows[0].count),
      totalOrders: Number(totalOrdersRes.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat statistik.' });
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM orders';
    const params = [];
    if (status) { params.push(status); query += ' WHERE status=$1'; }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json({ orders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat daftar pesanan.' });
  }
});

app.get('/api/admin/orders/:code', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id=$1', [result.rows[0].id]);
    res.json({ order: result.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat detail pesanan.' });
  }
});

app.post('/api/admin/orders/:code/processing', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (result.rows[0].status !== 'paid') return res.status(400).json({ error: 'Pesanan harus berstatus "paid" untuk diproses.' });
    const updateRes = await pool.query(`UPDATE orders SET status='processing', processing_at=NOW() WHERE order_code=$1 RETURNING *`, [req.params.code]);
    res.json({ order: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memperbarui status.' });
  }
});

app.post('/api/admin/orders/:code/shipped', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE order_code=$1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (result.rows[0].status !== 'processing') return res.status(400).json({ error: 'Pesanan harus berstatus "processing" untuk dikirim.' });
    const updateRes = await pool.query(`UPDATE orders SET status='shipped', shipped_at=NOW() WHERE order_code=$1 RETURNING *`, [req.params.code]);
    res.json({ order: updateRes.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memperbarui status.' });
  }
});

// Admin product CRUD
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json({ products: result.rows });
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, stock, image_url, description } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Nama dan harga wajib diisi.' });
    const result = await pool.query(
      `INSERT INTO products (name, category, price, stock, image_url, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, category || 'kacamata', price, stock || 0, image_url || null, description || null]
    );
    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menambahkan produk.' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, stock, image_url, description, is_active } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, category=$2, price=$3, stock=$4, image_url=$5, description=$6, is_active=$7 WHERE id=$8 RETURNING *`,
      [name, category, price, stock, image_url, description, is_active !== undefined ? is_active : true, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memperbarui produk.' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus produk. Mungkin produk ini sudah pernah dipesan.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
