/* Shared admin layout — used only inside /admin/*.html */
function renderAdminSidebar(active) {
  const root = document.getElementById('adminSidebarRoot');
  if (!root) return;
  const items = [
    { key: 'dashboard', href: 'dashboard.html', label: 'Dasbor', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>` },
    { key: 'products', href: 'products.html', label: 'Produk', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>` },
    { key: 'orders', href: 'orders.html', label: 'Pesanan', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>` },
  ];
  root.innerHTML = items.map(it => `
    <a href="${it.href}" class="${active === it.key ? 'active' : ''}">
      <span style="width:18px;height:18px;display:inline-flex;">${it.icon}</span> ${it.label}
    </a>
  `).join('') + `<a href="../index.html" style="margin-top:20px;border-top:1px solid var(--sky-50);padding-top:20px;">← Kembali ke Toko</a>`;
}

async function initAdminTopbar() {
  let user = null;
  try { const data = await apiCall('/auth/me'); user = data.user; } catch (e) {}
  const el = document.getElementById('adminTopbarUser');
  if (el && user) el.textContent = user.name;
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await apiCall('/auth/logout', { method: 'POST' });
      window.location.href = '../login.html';
    });
  }
}
