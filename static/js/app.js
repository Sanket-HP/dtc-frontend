/* DataTrust Coin – Frontend Application */

const API = 'http://127.0.0.1:8000/api';
let authToken = localStorage.getItem('dtc_token') || '';
let currentUser = null;

/* ── Helpers ──────────────────────────────────────────────────────── */

function headers(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      method: opts.method || 'GET',
      headers: headers(opts.json !== false),
      body: opts.body,
      mode: "cors"
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API Error:", err);
    throw new Error("Server connection failed. Make sure backend is running.");
  }
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `dtc-toast dtc-toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

/* ── Auth ─────────────────────────────────────────────────────────── */

async function register() {
  const body = {
    username: $('#reg-username').value.trim(),
    email:    $('#reg-email').value.trim(),
    password: $('#reg-password').value,
    full_name: $('#reg-fullname').value.trim(),
    is_company: $('#reg-company').checked,
  };
  try {
    await api('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    toast('Account created! Please log in.');
    showSection('login');
  } catch (e) { toast(e.message, 'error'); }
}

async function login() {
  const body = {
    username: $('#login-username').value.trim(),
    password: $('#login-password').value,
  };
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    authToken = data.access_token;
    localStorage.setItem('dtc_token', authToken);
    toast('Logged in!');
    await loadUser();
    showSection('dashboard');
  } catch (e) { toast(e.message, 'error'); }
}

function logout() {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('dtc_token');
  updateNav();
  showSection('home');
  toast('Logged out');
}

async function loadUser() {
  // Decode JWT to get basic info, then refresh from server
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    currentUser = { id: payload.sub, username: payload.username };
    updateNav();
  } catch { currentUser = null; }
}

/* ── Navigation ───────────────────────────────────────────────────── */

function updateNav() {
  const loggedIn = !!authToken;
  $$('.nav-auth').forEach(el => el.style.display = loggedIn ? 'none' : '');
  $$('.nav-user').forEach(el => el.style.display = loggedIn ? '' : 'none');
  const nameEl = $('#nav-username');
  if (nameEl && currentUser) nameEl.textContent = currentUser.username;
}

function showSection(name) {
  $$('.dtc-section').forEach(s => s.classList.add('hidden'));
  const target = $(`#section-${name}`);
  if (target) target.classList.remove('hidden');
  // Load data for specific sections
  if (name === 'dashboard') loadDashboard();
  if (name === 'marketplace') loadMarketplace();
}

/* ── Dashboard ────────────────────────────────────────────────────── */

async function loadDashboard() {
  if (!authToken) return showSection('login');
  try {
    const [stats, datasets] = await Promise.all([
      api('/datasets/stats'),
      api('/datasets/mine'),
    ]);
    $('#stat-datasets').textContent = stats.total_datasets;
    $('#stat-records').textContent = stats.total_records.toLocaleString();
    $('#stat-tokens').textContent = stats.total_tokens_earned.toFixed(2);
    renderMyDatasets(datasets);
  } catch (e) { toast(e.message, 'error'); }
}

function renderMyDatasets(datasets) {
  const container = $('#my-datasets');
  if (!datasets.length) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <svg class="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p>No datasets yet. Upload your first dataset to earn DTC tokens!</p>
      </div>`;
    return;
  }
  container.innerHTML = datasets.map(ds => `
    <div class="dtc-card dtc-glow mb-4">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-lg font-semibold text-white">${esc(ds.title)}</h3>
          <p class="text-sm text-slate-400 mt-1">${esc(ds.description || 'No description')}</p>
          <div class="flex gap-3 mt-3">
            <span class="dtc-badge dtc-badge-primary">${esc(ds.category)}</span>
            <span class="text-sm text-slate-400">${ds.record_count} records</span>
            <span class="text-sm text-slate-400">${ds.file_format.toUpperCase()}</span>
          </div>
        </div>
        <div class="text-right">
          <span class="dtc-badge dtc-badge-green">+${ds.token_reward} DTC</span>
          <p class="text-xs text-slate-500 mt-2">${new Date(ds.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  `).join('');
}

/* ── Upload ───────────────────────────────────────────────────────── */

function showUploadTab(tab) {
  $$('.upload-tab-btn').forEach(b => {
    b.classList.toggle('bg-indigo-600', b.dataset.tab === tab);
    b.classList.toggle('text-white', b.dataset.tab === tab);
    b.classList.toggle('bg-slate-700', b.dataset.tab !== tab);
    b.classList.toggle('text-slate-300', b.dataset.tab !== tab);
  });
  $$('.upload-tab-content').forEach(c => c.classList.add('hidden'));
  $(`#upload-tab-${tab}`)?.classList.remove('hidden');
}

async function uploadFile() {
  const fileInput = $('#upload-file');
  const file = fileInput.files[0];
  if (!file) return toast('Select a file first', 'error');

  const fd = new FormData();
  fd.append('file', file);
  fd.append('title', $('#upload-title').value.trim() || file.name);
  fd.append('description', $('#upload-desc').value.trim());
  fd.append('category', $('#upload-category').value);

  try {
    const ds = await fetch(`${API}/datasets/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: fd,
    }).then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.detail); });
      return r.json();
    });
    toast(`Uploaded! Earned ${ds.token_reward} DTC tokens`);
    fileInput.value = '';
    showSection('dashboard');
  } catch (e) { toast(e.message, 'error'); }
}

async function uploadManual() {
  let records;
  try {
    records = JSON.parse($('#manual-records').value);
    if (!Array.isArray(records)) records = [records];
  } catch { return toast('Invalid JSON – enter an array of objects', 'error'); }

  const body = {
    title: $('#manual-title').value.trim() || 'Manual Dataset',
    description: $('#manual-desc').value.trim(),
    category: $('#manual-category').value,
    records,
  };
  try {
    const ds = await api('/datasets/manual', { method: 'POST', body: JSON.stringify(body) });
    toast(`Uploaded ${ds.record_count} records! Earned ${ds.token_reward} DTC`);
    showSection('dashboard');
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Marketplace ──────────────────────────────────────────────────── */

async function loadMarketplace() {
  try {
    const [categories, datasets] = await Promise.all([
      api('/marketplace/categories'),
      api('/marketplace/datasets'),
    ]);
    renderCategories(categories);
    renderMarketplace(datasets);
  } catch (e) { toast(e.message, 'error'); }
}

function renderCategories(cats) {
  const el = $('#mp-categories');
  el.innerHTML = `<button onclick="filterMarketplace('')" class="px-3 py-1 rounded-full text-sm bg-indigo-600 text-white">All</button>` +
    cats.map(c => `<button onclick="filterMarketplace('${esc(c.category)}')" class="px-3 py-1 rounded-full text-sm bg-slate-700 text-slate-300 hover:bg-slate-600">${esc(c.category)} (${c.count})</button>`).join('');
}

async function filterMarketplace(cat) {
  const url = cat ? `/marketplace/datasets?category=${encodeURIComponent(cat)}` : '/marketplace/datasets';
  try {
    const datasets = await api(url);
    renderMarketplace(datasets);
  } catch (e) { toast(e.message, 'error'); }
}

function renderMarketplace(datasets) {
  const el = $('#mp-datasets');
  if (!datasets.length) {
    el.innerHTML = '<p class="text-center text-slate-400 py-8">No datasets available yet.</p>';
    return;
  }
  el.innerHTML = datasets.map(ds => `
    <div class="dtc-card dtc-glow">
      <h3 class="text-lg font-semibold text-white mb-1">${esc(ds.title)}</h3>
      <p class="text-sm text-slate-400 mb-3">${esc(ds.description || 'No description')}</p>
      <div class="flex gap-2 mb-3">
        <span class="dtc-badge dtc-badge-primary">${esc(ds.category)}</span>
        <span class="text-sm text-slate-400">${ds.record_count} records</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-lg font-bold text-indigo-400">${ds.price} DTC</span>
        <div class="flex gap-2">
          <button onclick="previewDataset('${ds.id}')"
            class="px-3 py-1.5 text-sm rounded-lg bg-slate-600 hover:bg-slate-500 text-white">
            Preview
          </button>
          <button onclick="purchaseDataset('${ds.id}')"
            class="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
            Purchase
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function previewDataset(id) {
  try {
    const data = await api(`/datasets/${id}/preview`);
    const modal = $('#preview-modal');
    $('#preview-title').textContent = data.title;
    $('#preview-count').textContent = `${data.record_count} total records`;
    $('#preview-fields').textContent = data.fields.join(', ');
    const tbody = $('#preview-tbody');
    if (data.sample_records.length) {
      const cols = data.fields;
      tbody.innerHTML = data.sample_records.map(r =>
        '<tr>' + cols.map(c => `<td class="px-3 py-2 text-sm text-slate-300 border-b border-slate-700">${esc(String(r[c] ?? ''))}</td>`).join('') + '</tr>'
      ).join('');
      $('#preview-thead').innerHTML = '<tr>' + cols.map(c => `<th class="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase border-b border-slate-600">${esc(c)}</th>`).join('') + '</tr>';
    } else {
      tbody.innerHTML = '<tr><td class="text-center py-4 text-slate-400" colspan="99">No preview data</td></tr>';
    }
    modal.classList.remove('hidden');
  } catch (e) { toast(e.message, 'error'); }
}

function closePreview() { $('#preview-modal').classList.add('hidden'); }

async function purchaseDataset(id) {
  if (!authToken) return (toast('Please log in first', 'error'), showSection('login'));
  if (!confirm('Confirm purchase? Tokens will be deducted from your balance.')) return;
  try {
    await api('/marketplace/purchase', { method: 'POST', body: JSON.stringify({ dataset_id: id }) });
    toast('Dataset purchased successfully!');
    loadMarketplace();
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Utilities ────────────────────────────────────────────────────── */

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ── Initialization ───────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Bind nav buttons
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.nav));
  });

  // Bind auth forms
  $('#btn-register')?.addEventListener('click', register);
  $('#btn-login')?.addEventListener('click', login);
  $('#btn-logout')?.addEventListener('click', logout);

  // Bind upload
  $('#btn-upload-file')?.addEventListener('click', uploadFile);
  $('#btn-upload-manual')?.addEventListener('click', uploadManual);

  // Upload tabs
  $$('.upload-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showUploadTab(btn.dataset.tab));
  });

  // Check existing session
  if (authToken) {
    loadUser();
    showSection('dashboard');
  } else {
    showSection('home');
  }
  updateNav();
});
