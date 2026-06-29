// nav scroll state
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// active nav link
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
    a.classList.add('active');
  }
});

// scroll reveal
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// toast system
function showToast(msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    cart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastout 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// mobile menu placeholder
const mobileBtn = document.querySelector('.mobile-menu-btn');
if (mobileBtn) {
  mobileBtn.addEventListener('click', () => showToast('Mobile menu coming soon', 'info'));
}

// ── Local auth helpers (client-side fallback) ──
function getLocalUsers() { try { return JSON.parse(localStorage.getItem('local_users')||'[]'); } catch { return []; } }
function saveLocalUsers(u){ try { localStorage.setItem('local_users', JSON.stringify(u)); } catch {} }
async function hashPassword(password) {
  if (window.crypto && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  let h = 0; for (let i=0;i<password.length;i++) h = Math.imul(31,h) + password.charCodeAt(i) | 0;
  return (h>>>0).toString(16);
}

function getAuthUser() { try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; } }
function setAuth(user, token) { try { localStorage.setItem('authUser', JSON.stringify(user)); if (token) localStorage.setItem('authToken', token); } catch {} }
function clearAuth() { localStorage.removeItem('authUser'); localStorage.removeItem('authToken'); }

function renderAuthState() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  const user = getAuthUser();
  if (user && user.username) {
    actions.innerHTML = `
      <div class="nav-user-wrap">
        <span class="nav-hello">Hi, <strong class="nav-username">${escapeHtml(user.username)}</strong></span>
        <a href="pages/account.html" class="btn btn-ghost">Account</a>
        <button class="btn" id="nav-logout">Log out</button>
      </div>`;
    const btn = document.getElementById('nav-logout'); if (btn) btn.addEventListener('click', () => { clearAuth(); renderAuthState(); showToast('Logged out', 'info'); location.reload(); });
  } else {
    actions.innerHTML = `
      <button class="mobile-menu-btn" aria-label="Menu">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a href="pages/login.html" class="btn btn-ghost">Log in</a>
      <a href="pages/signup.html" class="btn btn-primary">Sign up</a>
    `;
  }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// render auth state on load
document.addEventListener('DOMContentLoaded', () => renderAuthState()); // update auth UI across tabs when localStorage changes
 window.addEventListener('storage', (e) => { if (e.key === 'authUser' || e.key === 'authToken') renderAuthState(); });