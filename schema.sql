-- ==========================================================
-- OptikCerah - Database Schema (PostgreSQL)
-- Jalankan file ini sekali di database Neon/Postgres kamu
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(30),
  role VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer' | 'admin'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'kacamata', -- kacamata | aksesoris | pendukung
  price NUMERIC(12,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'percent', -- 'percent' | 'amount'
  discount_value NUMERIC(12,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(20) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
  -- pending_payment -> paid -> processing -> shipped -> received
  -- atau -> expired / canceled
  payment_method VARCHAR(20),
  subtotal NUMERIC(12,2) NOT NULL,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  promo_code VARCHAR(30),
  recipient_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(60) NOT NULL,
  postal_code VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  processing_at TIMESTAMP,
  shipped_at TIMESTAMP,
  received_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  product_name VARCHAR(150) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
