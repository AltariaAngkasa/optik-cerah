/* =========================================================
   OptikCerah — Shared utilities (loaded on every page)
   ========================================================= */

const OC = {
  API_BASE: '/api',
  CART_KEY: 'oc_cart',
};

/* ---------- API helper ---------- */
async function apiCall(path, options = {}) {
  const res = await fetch(OC.API_BASE + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Terjadi kesalahan.');
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- Formatting ---------- */
function formatRupiah(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}
function formatDate(d) {
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Sudah Dibayar',
  processing: 'Diproses',
  shipped: 'Dikirim',
  received: 'Selesai Diterima',
  expired: 'Kedaluwarsa',
  canceled: 'Dibatalkan'
};
const STATUS_BADGE_CLASS = {
  pending_payment: 'badge-pending',
  paid: 'badge-paid',
  processing: 'badge-processing',
  shipped: 'badge-shipped',
  received: 'badge-received',
  expired: 'badge-expired',
  canceled: 'badge-canceled'
};
function statusBadge(status) {
  return `<span class="badge ${STATUS_BADGE_CLASS[status] || ''}">${STATUS_LABEL[status] || status}</span>`;
}

/* ---------- Toast ---------- */
function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}
function toast(message, type = '') {
  const c = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

/* ---------- Cart (localStorage, per-browser) ---------- */
function getCart() {
  try { return JSON.parse(localStorage.getItem(OC.CART_KEY)) || []; } catch (e) { return []; }
}
function saveCart(cart) {
  localStorage.setItem(OC.CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}
function cartCount() {
  return getCart().reduce((sum, it) => sum + it.quantity, 0);
}
function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find(it => it.product_id === product.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ product_id: product.id, name: product.name, price: Number(product.price), image_url: product.image_url, quantity: qty, stock: product.stock });
  }
  saveCart(cart);
  toast(`${product.name} ditambahkan ke keranjang`, 'success');
}
function removeFromCart(productId) {
  saveCart(getCart().filter(it => it.product_id !== productId));
}
function updateCartQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(it => it.product_id === productId);
  if (item) {
    item.quantity = Math.max(1, qty);
    saveCart(cart);
  }
}
function clearCart() { saveCart([]); }
function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  const count = cartCount();
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/* ---------- Navbar ---------- */
const NAV_ICONS = {
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
};

function brandMarkSvg() {
  return `<svg viewBox="0 0 40 40" fill="none"><circle cx="13" cy="20" r="10" stroke="#0284c7" stroke-width="2.6"/><circle cx="27" cy="20" r="10" stroke="#38bdf8" stroke-width="2.6"/><path d="M23 20h-6" stroke="#0284c7" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}

async function renderNavbar(activePage) {
  const root = document.getElementById('navbar-root');
  if (!root) return;

  let user = null;
  try { const data = await apiCall('/auth/me'); user = data.user; } catch (e) { /* not logged in */ }

  const links = [
    { href: 'index.html', label: 'Beranda', key: 'home' },
    { href: 'index.html#produk', label: 'Katalog', key: 'catalog' },
  ];

  root.innerHTML = `
    <nav class="navbar">
      <div class="container">
        <a href="index.html" class="brand">
          <span class="brand-mark">${brandMarkSvg()}</span>
          OptikCerah
        </a>
        <div class="nav-links">
          ${links.map(l => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`).join('')}
          ${user ? `<a href="orders.html" class="${activePage === 'orders' ? 'active' : ''}">Pesanan Saya</a>` : ''}
          ${user && user.role === 'admin' ? `<a href="admin/dashboard.html">Dasbor Admin</a>` : ''}
        </div>
        <div class="nav-actions">
          <a href="cart.html" class="icon-btn" title="Keranjang">
            ${NAV_ICONS.cart}
            <span class="cart-badge" style="display:none;">0</span>
          </a>
          ${user
            ? `<button class="btn btn-secondary btn-sm" id="logoutBtn">Keluar</button>`
            : `<a href="login.html" class="btn btn-primary btn-sm">Masuk</a>`
          }
        </div>
      </div>
    </nav>
  `;
  updateCartBadge();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await apiCall('/auth/logout', { method: 'POST' });
      toast('Berhasil keluar', 'success');
      setTimeout(() => window.location.href = 'index.html', 500);
    });
  }

  return user;
}

async function requireLoginOrRedirect(redirectTo) {
  try {
    const data = await apiCall('/auth/me');
    if (!data.user) { window.location.href = `login.html?next=${encodeURIComponent(redirectTo || location.pathname)}`; return null; }
    return data.user;
  } catch (e) {
    window.location.href = 'login.html';
    return null;
  }
}

async function requireAdminOrRedirect() {
  try {
    const data = await apiCall('/auth/me');
    if (!data.user || data.user.role !== 'admin') { window.location.href = '../login.html'; return null; }
    return data.user;
  } catch (e) {
    window.location.href = '../login.html';
    return null;
  }
}

/* ---------- Scroll reveal ---------- */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || els.length === 0) {
    els.forEach(el => el.classList.add('in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  initReveal();
});
