let selectedId = null;
let authToken = localStorage.getItem('token') || null;
let allHospitals = [];
let userInfo = null;
let isAdminUser = false;

function isAdmin() { return isAdminUser; }

async function checkAuth() {
  if (!authToken) { showAuth(); return; }
  try {
    const me = await api('/api/me');
    if (!me.authed) { logout(); return; }
    isAdminUser = me.role === 'admin';
    userInfo = me.user || null;
    hideAuth();
    updateAdminUI();
    loadHospitals();
  } catch { logout(); }
}

function confirmLogout() {
  if (confirm('Se déconnecter ?')) logout();
}

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { headers, ...opts }).then(async res => {
    if (res.status === 401) { logout(); throw new Error('Session expirée'); }
    if (!res.ok) {
      let msg;
      try { const j = await res.json(); msg = j.error || j.message || res.statusText; }
      catch { msg = await res.text(); }
      throw new Error(msg);
    }
    return res.json();
  });
}

// ===== SIDEBAR =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item, .tab-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.getElementById(`view-${name}`).classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'hospitals') loadHospitals();
  if (name === 'inbox') loadInbox();
  if (name === 'candidatures') loadCandidatures();
  if (name === 'users') loadUsers();
  if (name === 'grandegarde') loadProtocols();
  if (name === 'checklist') loadChecklist();
  if (name === 'profile') loadProfile();
  if (name === 'desiderata') loadDesiderata();
  if (name === 'planning') loadPlanning();
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
  return false;
}

// ===== DARK MODE =====
// Sans choix enregistré, on suit le réglage du téléphone
const savedDark = localStorage.getItem('dark');
if (savedDark === 'true' || (savedDark === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.body.classList.add('dark');
}
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark'));
  updateDarkUI();
}
function updateDarkUI() {
  const dark = document.body.classList.contains('dark');
  document.getElementById('darkIcon').className = `ph ${dark ? 'ph-sun' : 'ph-moon'} nav-icon`;
  document.getElementById('darkText').textContent = dark ? 'Mode clair' : 'Mode sombre';
}
updateDarkUI();

function logout() {
  if (authToken) api('/api/logout', { method: 'POST' }).catch(() => {});
  authToken = null;
  isAdminUser = false;
  userInfo = null;
  localStorage.removeItem('token');
  showAuth();
}

// ===== USER AUTH =====
function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appRoot').classList.add('hidden');
}

function hideAuth() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
}

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  document.querySelectorAll('.auth-error').forEach(e => e.classList.add('hidden'));
  document.querySelectorAll('.auth-success').forEach(e => e.classList.add('hidden'));
  if (tab === 'login') {
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('loginForm').classList.remove('hidden');
  } else if (tab === 'register') {
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('registerForm').classList.remove('hidden');
  }
}

async function doLoginUser(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken = res.token;
    localStorage.setItem('token', res.token);
    isAdminUser = res.role === 'admin';
    userInfo = res.user;
    hideAuth();
    updateAdminUI();
    loadHospitals();
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
    document.getElementById('loginError').classList.remove('hidden');
  }
}

async function doRegister(e) {
  e.preventDefault();
  document.querySelectorAll('.auth-error').forEach(el => el.classList.add('hidden'));
  document.getElementById('registerSuccess').classList.add('hidden');
  const data = {
    nom: document.getElementById('regNom').value,
    prenom: document.getElementById('regPrenom').value,
    email: document.getElementById('regEmail').value,
    aph: document.getElementById('regAph').value.trim(),
    password: document.getElementById('regPassword').value,
  };
  try {
    const res = await api('/api/register', { method: 'POST', body: JSON.stringify(data) });
    document.getElementById('registerSuccess').textContent = res.message;
    document.getElementById('registerSuccess').classList.remove('hidden');
    document.getElementById('registerForm').querySelector('button').disabled = true;
  } catch (err) {
    document.getElementById('registerError').textContent = err.message;
    document.getElementById('registerError').classList.remove('hidden');
  }
}

function updateAdminUI() {
  const admin = isAdmin();
  const loggedIn = !!authToken;
  document.getElementById('adminBadge').classList.toggle('hidden', !admin);
  document.getElementById('addBtn').style.display = admin ? '' : 'none';
  document.getElementById('addProtocolBtn').style.display = admin ? '' : 'none';
  document.getElementById('navAdminGroup').classList.toggle('hidden', !admin);
  if (admin) { loadInboxCount(); loadCandidaturesCount(); }
  document.getElementById('navProfile').classList.toggle('hidden', !userInfo);

  // Bouton de déconnexion avec le nom de l'utilisateur (admins compris)
  const showUser = loggedIn && userInfo;
  document.getElementById('userInfo').classList.toggle('hidden', !showUser);
  if (showUser) document.getElementById('userInfoName').textContent = `${userInfo.prenom} ${userInfo.nom}`;
  if (loggedIn) refreshAccess();
}

// ===== ACCÈS PAR UTILISATEUR =====
// Menus que l'admin peut masquer pour un utilisateur (clés = data-view)
const ACCESS_MENUS = [
  ['hospitals', 'Hôpitaux'], ['recherche', 'Recherche rapide'], ['checklist', 'Check-list'],
  ['grandegarde', 'Grande garde'], ['desiderata', 'Desiderata'], ['contact', 'Proposer une modification'],
];
let userAccess = { hidden: [], planner: false };

async function refreshAccess() {
  if (isAdmin()) {
    userAccess = { hidden: [], planner: true };
  } else {
    try {
      const p = await api('/api/profile');
      userAccess = { hidden: String(p.hidden_menus || '').split(',').filter(Boolean), planner: Number(p.planner) === 1 };
    } catch { userAccess = { hidden: [], planner: false }; }
  }
  document.querySelectorAll('.nav-item[data-view], .tab-item[data-view]').forEach(el => {
    if (ACCESS_MENUS.some(([k]) => k === el.dataset.view)) el.classList.toggle('hidden', userAccess.hidden.includes(el.dataset.view));
  });
  document.getElementById('navPlanning').classList.toggle('hidden', !userAccess.planner);
  // Si la vue affichée vient d'être masquée, on bascule sur le premier menu visible
  const active = document.querySelector('.view.active')?.id.replace('view-', '');
  const blocked = userAccess.hidden.includes(active) || (active === 'planning' && !userAccess.planner);
  if (blocked) {
    const first = document.querySelector('.sidebar-nav .nav-item[data-view]:not(.hidden)');
    if (first) showView(first.dataset.view);
  }
}

// ===== HOSPITALS (accent-insensitive) =====
async function loadHospitals() {
  allHospitals = await api('/api/hospitals');
  document.getElementById('hospitalCount').textContent = allHospitals.length;
  document.getElementById('subtitleHospitals').textContent =
    `${allHospitals.length} établissement${allHospitals.length > 1 ? 's' : ''}`;
  renderHospitalList('');
}

function renderHospitalList(search) {
  const q = normalize(search);
  const filtered = !q ? allHospitals : allHospitals.filter(h =>
    normalize(h.name).includes(q) ||
    normalize(h.address).includes(q) ||
    normalize(h.phone).includes(q)
  );
  const container = document.getElementById('hospitalList');
  if (!filtered.length) { container.innerHTML = '<div class="empty-state">Aucun résultat</div>'; return; }
  container.innerHTML = filtered.map(h => `
    <button type="button" class="hospital-card ${selectedId === h.id ? 'active' : ''}" onclick="selectHospital(${h.id})">
      <span class="hospital-card-text">
        <h3>${esc(h.name)}</h3>
        <span class="addr">${esc(h.address)}</span>
      </span>
      <i class="ph ph-caret-right chevron"></i>
    </button>
  `).join('');
}

// Search input handler (replaces old topbar search)
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    document.getElementById('quickSearchInput')?.focus();
  }
});

// ===== SELECT HOSPITAL =====
async function selectHospital(id) {
  selectedId = id;
  showView('hospitals');
  const h = await api(`/api/hospitals/${id}`);
  const admin = isAdmin();

  // Mobile: cacher la liste, afficher le détail
  if (window.innerWidth <= 768) {
    document.querySelector('.panel-list').classList.add('has-selected');
    document.querySelector('.panel-detail').classList.add('has-selected');
  }

  // Services regroupés par bâtiment, chacun en carte
  const groups = {};
  for (const s of h.services) {
    const site = s.building || 'Général';
    if (!groups[site]) groups[site] = [];
    groups[site].push(s);
  }
  const serviceCard = s => {
    const facts = [
      s.floor ? `<span class="fact"><i class="ph ph-stairs"></i>${esc(formatFloor(s.floor))}</span>` : '',
      s.door_codes ? `<span class="fact fact-code"><i class="ph ph-key"></i>${esc(s.door_codes)}</span>` : '',
      s.phone ? telLink(s.phone, 'fact') : '',
    ].join('');
    return `
      <article class="svc">
        <div class="svc-top">
          <h4>${esc(s.name)}</h4>
          ${admin ? `<div class="svc-tools">
            <button type="button" class="ghost-btn" onclick="showServiceModal(${h.id},${s.id})" aria-label="Modifier ${esc(s.name)}" title="Modifier"><i class="ph ph-pencil-simple"></i></button>
            <button type="button" class="ghost-btn danger" onclick="deleteService(${s.id})" aria-label="Supprimer ${esc(s.name)}" title="Supprimer"><i class="ph ph-trash"></i></button>
          </div>` : ''}
        </div>
        ${s.description ? `<p class="svc-desc">${esc(s.description)}</p>` : ''}
        ${facts ? `<div class="svc-facts">${facts}</div>` : ''}
        ${(s.lat && s.lng) ? `<div class="svc-entrance">
          <span class="svc-entrance-tag"><i class="ph ph-door-open"></i> Entrée spécifique</span>
          <div class="svc-gps">
            <button type="button" class="btn btn-sm btn-primary" onclick="openGps('google', ${s.lat}, ${s.lng})"><i class="ph ph-google-logo"></i> Maps</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="openGps('waze', ${s.lat}, ${s.lng})"><i class="ph ph-navigation-arrow"></i> Waze</button>
          </div>
        </div>` : ''}
      </article>`;
  };
  const sites = Object.entries(groups).map(([site, svcs]) => `
    <div class="site">
      <div class="site-name"><i class="ph ph-buildings"></i> ${esc(site)}</div>
      <div class="svc-grid">${svcs.map(serviceCard).join('')}</div>
    </div>`).join('');

  document.getElementById('hospitalDetail').innerHTML = `
    <button type="button" class="mobile-back" onclick="backToList()"><i class="ph ph-caret-left"></i> Hôpitaux</button>
    <header class="hd">
      <div class="hd-top">
        <div class="hd-title">
          <h2>${esc(h.name)}</h2>
          <p class="hd-line"><i class="ph ph-map-pin"></i><span>${esc(h.address)}</span></p>
          ${h.phone ? `<p class="hd-line">${telLink(h.phone)}</p>` : ''}
        </div>
        ${admin ? `<div class="hd-tools">
          <button type="button" class="ghost-btn" onclick="showHospitalModal(${h.id})" aria-label="Modifier l'hôpital" title="Modifier l'hôpital"><i class="ph ph-pencil-simple"></i></button>
          <button type="button" class="ghost-btn danger" onclick="if(confirm('Supprimer cet hôpital et ses services ?')) deleteHospital(${h.id})" aria-label="Supprimer l'hôpital" title="Supprimer l'hôpital"><i class="ph ph-trash"></i></button>
        </div>` : ''}
      </div>
      ${(h.lat && h.lng) ? `<div class="go">
        <span class="go-label"><i class="ph ph-navigation-arrow"></i> Entrée principale</span>
        <div class="go-btns">
          <button type="button" class="btn btn-primary" onclick="openGps('google', ${h.lat}, ${h.lng})"><i class="ph ph-google-logo"></i> Google Maps</button>
          <button type="button" class="btn btn-secondary" onclick="openGps('waze', ${h.lat}, ${h.lng})"><i class="ph ph-navigation-arrow"></i> Waze</button>
        </div>
      </div>` : ''}
    </header>
    <section class="svc-list">
      <div class="svc-list-head">
        <h3>Services <span class="count">${h.services.length}</span></h3>
        ${admin ? `<button type="button" class="btn btn-secondary btn-sm" onclick="showServiceModal(${h.id})"><i class="ph ph-plus"></i> Ajouter un service</button>` : ''}
      </div>
      ${h.services.length === 0 ? '<div class="empty-state">Aucun service enregistré pour cet hôpital.</div>' : sites}
    </section>`;
  renderHospitalList('');
}

// « 1 » devient « Étage 1 », « 0 » « Rez-de-chaussée » ; le reste tel quel
function formatFloor(floor) {
  const f = String(floor).trim();
  if (/^0$/.test(f)) return 'Rez-de-chaussée';
  if (/^-?\d+$/.test(f)) return 'Étage ' + f;
  return f;
}

function backToList() {
  document.querySelector('.panel-list').classList.remove('has-selected');
  document.querySelector('.panel-detail').classList.remove('has-selected');
}

// ===== QUICK SEARCH (accent-insensitive) =====
let quickTimer;
function quickSearch() {
  clearTimeout(quickTimer);
  quickTimer = setTimeout(() => {
    const raw = document.getElementById('quickSearchInput').value;
    const q = normalize(raw);
    const container = document.getElementById('quickResults');
    if (!q) { container.innerHTML = ''; return; }
    const results = allHospitals.filter(h =>
      normalize(h.name).includes(q) || normalize(h.address).includes(q) ||
      normalize(h.phone).includes(q)
    );
    // Also search via API for service-level matches (sends raw input for server-side accent-insensitive search)
    if (results.length === 0) {
      api(`/api/hospitals?search=${encodeURIComponent(raw)}`).then(hs => {
        container.innerHTML = hs.length === 0 ? '<div class="empty-state">Aucun résultat. Essayez un autre mot.</div>'
          : hs.map(resultCard).join('');
      });
    } else {
      container.innerHTML = results.map(resultCard).join('');
    }
  }, 200);
}

function resultCard(h) {
  return `<button type="button" class="result-card" onclick="selectHospital(${h.id})">
    <span><h4>${esc(h.name)}</h4><p>${esc(h.address)}</p></span><i class="ph ph-caret-right chevron"></i>
  </button>`;
}

// ===== CONTACT =====
function toggleContactHospital() {
  const type = document.getElementById('contactType').value;
  document.getElementById('contactHospitalFields').style.display =
    ['new_hospital','new_service','correction'].includes(type) ? '' : 'none';
}

async function sendContact(e) {
  e.preventDefault();
  const type = document.getElementById('contactType').value;
  const typeLabels = { new_hospital: 'Nouvel hôpital', new_service: 'Nouveau service', correction: 'Correction', other: 'Autre' };
  let msg = `Type: ${typeLabels[type] || type}\n`;
  if (document.getElementById('contactHospital').value) msg += `Hôpital: ${document.getElementById('contactHospital').value}\n`;
  if (document.getElementById('contactService').value) msg += `Service: ${document.getElementById('contactService').value}\n`;
  if (document.getElementById('contactBuilding').value) msg += `Bâtiment: ${document.getElementById('contactBuilding').value}\n`;
  if (document.getElementById('contactFloor').value) msg += `Étage: ${document.getElementById('contactFloor').value}\n`;
  if (document.getElementById('contactDoorCode').value) msg += `Code porte: ${document.getElementById('contactDoorCode').value}\n`;
  if (document.getElementById('contactPhone').value) msg += `Tél: ${document.getElementById('contactPhone').value}\n`;
  msg += `\nMessage:\n${document.getElementById('contactMessage').value}`;

  const btn = e.target.querySelector('button[type=submit]');
  if (btn) btn.disabled = true;
  try {
    await api('/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        subject: typeLabels[type] || 'Contact',
        message: msg,
      })
    });
    document.getElementById('contactForm').reset();
    document.getElementById('contactForm').style.display = 'none';
    document.getElementById('contactSuccess').classList.remove('hidden');
  } catch (err) {
    alert('Erreur lors de l\'envoi : ' + err.message);
    if (btn) btn.disabled = false;
  }
}

// ===== INBOX =====
async function loadInbox() {
  const msgs = await api('/api/messages');
  const container = document.getElementById('inboxList');
  if (!msgs.length) { container.innerHTML = '<div class="empty-state">Aucun message</div>'; return; }
  container.innerHTML = msgs.map(m => `
    <div class="inbox-card ${m.read ? '' : 'unread'}" onclick="markRead(${m.id})">
      <h4>${esc(m.subject || 'Sans sujet')}</h4>
      <div class="inbox-meta"><span>${esc(m.name)} (${esc(m.email)})</span><span>${m.created_at}</span></div>
      <div class="inbox-body">${esc(m.message)}</div>
      <div class="inbox-actions">
        <button type="button" class="icon-btn danger" aria-label="Supprimer" onclick="event.stopPropagation();if(confirm('Supprimer ?')) deleteMessage(${m.id})"><i class="ph ph-trash"></i></button>
      </div>
    </div>`).join('');
  loadInboxCount();
}

async function loadInboxCount() {
  try {
    const msgs = await api('/api/messages');
    document.getElementById('inboxCount').textContent = msgs.filter(m => !m.read).length;
  } catch {}
}
async function markRead(id) { await api(`/api/messages/${id}/read`, { method: 'PUT' }); loadInbox(); }
async function deleteMessage(id) { await api(`/api/messages/${id}`, { method: 'DELETE' }); loadInbox(); }

// ===== CANDIDATURES =====
async function loadCandidatures() {
  const users = await api('/api/pending-users');
  const container = document.getElementById('candidaturesList');
  if (!users.length) {
    container.innerHTML = '<div class="empty-state">Aucune candidature en attente</div>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="inbox-item">
      <h4>${esc(u.prenom)} ${esc(u.nom)}</h4>
      <div class="inbox-meta"><span>${esc(u.email)}</span>${u.aph ? `<span>APH ${esc(u.aph)}</span>` : ''}</div>
      <div class="inbox-meta"><span>Inscrit le ${u.created_at}</span></div>
      <div class="inbox-actions">
        <button type="button" class="btn btn-sm btn-primary" onclick="approveUser(${u.id})"><i class="ph ph-check"></i> Valider</button>
        <button type="button" class="btn btn-sm btn-danger" onclick="if(confirm('Refuser cette candidature ?')) rejectUser(${u.id})"><i class="ph ph-x"></i> Refuser</button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="if(confirm('Promouvoir ${esc(u.prenom)} ${esc(u.nom)} en administrateur ?')) promoteUser(${u.id})"><i class="ph ph-crown"></i> Admin</button>
      </div>
    </div>
  `).join('');
}

async function loadCandidaturesCount() {
  try {
    const users = await api('/api/pending-users');
    document.getElementById('candidaturesCount').textContent = users.length;
  } catch {}
}

async function approveUser(id) {
  await api(`/api/users/${id}/approve`, { method: 'PUT' });
  loadCandidatures();
  loadCandidaturesCount();
}

async function rejectUser(id) {
  await api(`/api/users/${id}/reject`, { method: 'DELETE' });
  loadCandidatures();
  loadCandidaturesCount();
}

async function promoteUser(id) {
  await api(`/api/users/${id}/promote`, { method: 'PUT' });
  loadCandidatures();
  loadCandidaturesCount();
  alert('Utilisateur promu administrateur. Il doit se reconnecter pour que le changement prenne effet.');
}

// ===== USERS (admin: all users) =====
async function loadUsers() {
  const users = await api('/api/users');
  const container = document.getElementById('usersList');
  if (!users.length) { container.innerHTML = '<div class="empty-state">Aucun utilisateur</div>'; return; }
  container.innerHTML = users.map(u => `
    <div class="inbox-item">
      <h4>${esc(u.prenom)} ${esc(u.nom)} ${u.role === 'admin' ? '<i class="ph ph-crown" title="Admin"></i>' : ''}</h4>
      <div class="inbox-meta"><span>${esc(u.email)}</span>${u.aph ? `<span>APH ${esc(u.aph)}</span>` : ''}</div>
      <div class="inbox-meta">
        <span>Inscrit le ${u.created_at}</span>
        <span class="badge-status ${u.status}">${({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' })[u.status] || esc(u.status)}</span>
      </div>
      <div class="inbox-actions" style="flex-wrap:wrap">
        <select class="status-select" onchange="updateUserRole(${u.id}, this.value)">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
        <button type="button" class="btn btn-sm btn-danger" onclick="if(confirm('Supprimer définitivement ${esc(u.prenom)} ${esc(u.nom)} ?')) deleteUser(${u.id})"><i class="ph ph-trash"></i> Supprimer</button>
      </div>
      <details class="access">
        <summary><i class="ph ph-user-gear"></i> Accès aux menus</summary>
        <form class="access-form" onsubmit="saveAccess(event, ${u.id})">
          <div class="access-grid">
            ${ACCESS_MENUS.map(([k, label]) => `
              <label><input type="checkbox" name="menu" value="${k}" ${String(u.hidden_menus || '').split(',').includes(k) ? '' : 'checked'}> ${label}</label>`).join('')}
          </div>
          <label class="access-planner"><input type="checkbox" name="planner" ${Number(u.planner) === 1 ? 'checked' : ''}> Fait le planning (voir et exporter les desiderata)</label>
          <div class="access-actions">
            <button type="submit" class="btn btn-primary btn-sm">Enregistrer</button>
            <span class="access-saved hidden"><i class="ph ph-check-circle"></i> Enregistré</span>
          </div>
        </form>
      </details>
    </div>
  `).join('');
}

async function saveAccess(e, id) {
  e.preventDefault();
  const form = e.target;
  const hidden = [...form.querySelectorAll('input[name="menu"]:not(:checked)')].map(c => c.value);
  const planner = form.querySelector('input[name="planner"]').checked;
  try {
    await api(`/api/users/${id}/access`, { method: 'PUT', body: JSON.stringify({ hidden_menus: hidden, planner }) });
    form.querySelector('.access-saved').classList.remove('hidden');
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}

async function updateUserRole(id, role) {
  await api(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
  loadUsers();
  loadCandidatures();
  loadCandidaturesCount();
}

async function deleteUser(id) {
  await api(`/api/users/${id}`, { method: 'DELETE' });
  loadUsers();
  loadCandidatures();
  loadCandidaturesCount();
}

// ===== MODALS =====
function showHospitalModal(id) {
  document.getElementById('hospitalModalTitle').textContent = id ? 'Modifier' : 'Ajouter un hôpital';
  document.getElementById('hId').value = id || '';
  document.getElementById('hSearch').value = '';
  document.getElementById('hResults').innerHTML = '';
  if (id) {
    api(`/api/hospitals/${id}`).then(h => {
      document.getElementById('hName').value = h.name;
      document.getElementById('hAddress').value = h.address;
      document.getElementById('hPhone').value = h.phone;
      document.getElementById('hLat').value = h.lat;
      document.getElementById('hLng').value = h.lng;
      hospitalPicker.show();
    });
  } else {
    ['hName','hAddress','hPhone','hLat','hLng'].forEach(id => document.getElementById(id).value = '');
    hospitalPicker.show();
  }
  document.getElementById('hospitalModal').classList.remove('hidden');
}

// ===== INSTALLER L'APPLICATION (À propos) =====
// Dans l'appli Android, la section n'a pas lieu d'être ; ailleurs, on met en
// premier les consignes du téléphone utilisé.
(function setupInstallSection() {
  const section = document.getElementById('installSection');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isNativeApp() || standalone) { section.classList.add('hidden'); return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) document.getElementById('installIphone').classList.add('first');
  else if (/Android/.test(navigator.userAgent)) document.getElementById('installAndroid').classList.add('first');
})();

// ===== CARTE ET RECHERCHE DE LIEU (fiches hôpital et service) =====
// Leaflet + fonds OpenStreetMap, chargés seulement à l'ouverture d'une fiche.
const SMUR_BEAUJON = [48.9082, 2.3104];
let leafletLoading = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = resolve;
    js.onerror = () => { leafletLoading = null; reject(new Error('Carte indisponible')); };
    document.head.appendChild(js);
  });
  return leafletLoading;
}

// Carte avec repère déplaçable, reliée à deux champs latitude / longitude.
// Un appui sur la carte ou un glissement du repère met les champs à jour.
function makeMapPicker(mapId, latId, lngId) {
  const latEl = document.getElementById(latId), lngEl = document.getElementById(lngId);
  const p = { map: null, marker: null };
  p.coords = () => {
    const lat = parseFloat(latEl.value), lng = parseFloat(lngEl.value);
    return (lat && lng) ? [lat, lng] : null;
  };
  p.set = (lat, lng) => {
    latEl.value = lat.toFixed(6);
    lngEl.value = lng.toFixed(6);
    if (p.marker) p.marker.setLatLng([lat, lng]).setOpacity(1);
  };
  // `fallback` : centre affiché tant qu'aucun point n'est placé
  p.show = async (fallback = SMUR_BEAUJON, fallbackZoom = 13) => {
    try { await loadLeaflet(); } catch { document.getElementById(mapId).textContent = 'Carte indisponible (pas de connexion ?).'; return; }
    const at = p.coords();
    if (!p.map) {
      p.map = L.map(mapId, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap',
      }).addTo(p.map);
      const pin = L.divIcon({ className: 'geo-pin', html: '<i class="ph ph-map-pin"></i>', iconSize: [36, 36], iconAnchor: [18, 34] });
      p.marker = L.marker(fallback, { draggable: true, icon: pin }).addTo(p.map);
      p.marker.on('dragend', () => { const ll = p.marker.getLatLng(); p.set(ll.lat, ll.lng); });
      p.map.on('click', e => p.set(e.latlng.lat, e.latlng.lng));
    }
    p.marker.setLatLng(at || fallback).setOpacity(at ? 1 : 0.45);
    // La fenêtre vient d'apparaître : Leaflet doit remesurer la carte
    setTimeout(() => { p.map.invalidateSize(); p.map.setView(at || fallback, at ? 17 : fallbackZoom); }, 60);
  };
  p.syncFromInputs = () => {
    const at = p.coords();
    if (at && p.marker) { p.marker.setLatLng(at).setOpacity(1); p.map.panTo(at); }
  };
  p.checkInGoogleMaps = () => {
    const at = p.coords();
    if (!at) { alert('Placez d\'abord le repère sur la carte.'); return; }
    openExternal(`https://www.google.com/maps/search/?api=1&query=${at[0]},${at[1]}`);
  };
  return p;
}
const hospitalPicker = makeMapPicker('hMap', 'hLat', 'hLng');
const servicePicker = makeMapPicker('sMap', 'sLat', 'sLng');

let geoTimer, geoResults = [];
function geoSearch() {
  clearTimeout(geoTimer);
  const q = document.getElementById('hSearch').value.trim();
  const box = document.getElementById('hResults');
  if (q.length < 3) { box.innerHTML = ''; return; }
  geoTimer = setTimeout(async () => {
    box.innerHTML = '<div class="geo-status">Recherche…</div>';
    try {
      geoResults = await api(`/api/geocode?q=${encodeURIComponent(q)}`);
      box.innerHTML = geoResults.length === 0
        ? '<div class="geo-status">Aucun lieu trouvé. Essayez avec la ville.</div>'
        : geoResults.map((p, i) => `<button type="button" class="geo-result" role="option" onclick="pickPlace(${i})">
            <i class="ph ph-map-pin"></i><span><strong>${esc(p.name || p.address)}</strong><small>${esc(p.name ? p.address : p.detail)}</small></span>
          </button>`).join('');
    } catch (err) {
      box.innerHTML = `<div class="geo-status">${esc(err.message)}</div>`;
    }
  }, 450);
}

function pickPlace(i) {
  const p = geoResults[i];
  const name = document.getElementById('hName');
  if (!name.value.trim() && p.name) name.value = p.name;
  document.getElementById('hAddress').value = p.address;
  hospitalPicker.set(p.lat, p.lng);
  hospitalPicker.map.setView([p.lat, p.lng], 17);
  document.getElementById('hResults').innerHTML = '';
}

async function saveHospital(e) {
  e.preventDefault();
  const id = document.getElementById('hId').value;
  const data = {
    name: document.getElementById('hName').value,
    address: document.getElementById('hAddress').value,
    phone: document.getElementById('hPhone').value,
    lat: parseFloat(document.getElementById('hLat').value) || 0,
    lng: parseFloat(document.getElementById('hLng').value) || 0,
  };
  try {
    if (id) await api(`/api/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api('/api/hospitals', { method: 'POST', body: JSON.stringify(data) });
    closeModal('hospitalModal');
    selectedId = id ? parseInt(id) : null;
    if (selectedId) selectHospital(selectedId);
    loadHospitals();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteHospital(id) {
  await api(`/api/hospitals/${id}`, { method: 'DELETE' });
  selectedId = null;
  backToList();
  document.getElementById('hospitalDetail').innerHTML = `<div class="empty-detail"><i class="ph ph-hospital empty-icon"></i><h3>Sélectionnez un hôpital</h3></div>`;
  loadHospitals();
}

// Position de l'hôpital du service ouvert : point de départ de la carte d'entrée
let serviceHospitalCoords = SMUR_BEAUJON;

async function showServiceModal(hospitalId, serviceId) {
  document.getElementById('serviceModalTitle').textContent = serviceId ? 'Modifier' : 'Ajouter un service';
  document.getElementById('sHospitalId').value = hospitalId;
  document.getElementById('sId').value = serviceId || '';
  // La fenêtre s'ouvre tout de suite ; les champs se remplissent ensuite
  document.getElementById('serviceModal').classList.remove('hidden');
  const h = await api(`/api/hospitals/${hospitalId}`);
  serviceHospitalCoords = (h.lat && h.lng) ? [h.lat, h.lng] : SMUR_BEAUJON;
  const s = serviceId ? h.services.find(sv => Number(sv.id) === Number(serviceId)) : null;
  if (serviceId && !s) { closeModal('serviceModal'); showToast('Service introuvable, rechargez la page'); return; }
  document.getElementById('sName').value = s ? s.name : '';
  document.getElementById('sBuilding').value = s ? s.building || '' : '';
  document.getElementById('sFloor').value = s ? s.floor || '' : '';
  document.getElementById('sDoorCodes').value = s ? s.door_codes || '' : '';
  document.getElementById('sDescription').value = s ? s.description || '' : '';
  document.getElementById('sPhone').value = s ? s.phone || '' : '';
  const hasEntrance = !!(s && s.lat && s.lng);
  const box = document.getElementById('sHasEntrance');
  if (!box) return; // ancienne page en cache : le reste du formulaire fonctionne
  box.checked = hasEntrance;
  document.getElementById('sLat').value = hasEntrance ? s.lat : '';
  document.getElementById('sLng').value = hasEntrance ? s.lng : '';
  document.getElementById('sEntrance').classList.toggle('hidden', !hasEntrance);
  if (hasEntrance) servicePicker.show(serviceHospitalCoords, 17);
}

// Case « Entrée différente » : on part de la position de l'hôpital, à déplacer
function toggleServiceEntrance() {
  const on = document.getElementById('sHasEntrance').checked;
  document.getElementById('sEntrance').classList.toggle('hidden', !on);
  if (!on) return;
  if (!servicePicker.coords()) servicePicker.set(...serviceHospitalCoords);
  servicePicker.show(serviceHospitalCoords, 17);
}

async function saveService(e) {
  e.preventDefault();
  const id = document.getElementById('sId').value;
  const hospitalId = document.getElementById('sHospitalId').value;
  const data = {
    hospital_id: parseInt(hospitalId),
    name: document.getElementById('sName').value,
    building: document.getElementById('sBuilding').value,
    floor: document.getElementById('sFloor').value,
    door_codes: document.getElementById('sDoorCodes').value,
    description: document.getElementById('sDescription').value,
    phone: document.getElementById('sPhone').value,
    // Entrée propre au service, ou null pour garder celle de l'hôpital
    lat: document.getElementById('sHasEntrance')?.checked ? parseFloat(document.getElementById('sLat').value) || null : null,
    lng: document.getElementById('sHasEntrance')?.checked ? parseFloat(document.getElementById('sLng').value) || null : null,
  };
  try {
    if (id) await api(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api('/api/services', { method: 'POST', body: JSON.stringify(data) });
    closeModal('serviceModal');
    if (selectedId) selectHospital(parseInt(hospitalId));
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteService(id) {
  if (!confirm('Supprimer ce service ?')) return;
  const hId = selectedId;
  await api(`/api/services/${id}`, { method: 'DELETE' });
  if (hId) selectHospital(hId);
}

// Dans l'appli Android (WebView Capacitor), un window.open peut s'afficher dans la
// WebView elle-même. Une navigation de premier niveau vers un autre domaine est en
// revanche interceptée par Capacitor et confiée au navigateur du téléphone.
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
    || /; wv\)/.test(navigator.userAgent);
}
function openExternal(url) {
  if (isNativeApp()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

// GPS : sur le téléphone, on ouvre directement l'application choisie via son
// schéma (Capacitor transmet ces liens à Android). Si l'appli n'est pas installée,
// la page reste visible : on retombe alors sur le lien web au bout d'un instant.
function openGps(app, lat, lng) {
  const web = app === 'waze'
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (!isNativeApp()) return openExternal(web);
  const native = app === 'waze'
    ? `waze://?ll=${lat},${lng}&navigate=yes`
    : `google.navigation:q=${lat},${lng}&mode=d`;
  let left = false;
  const onHide = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = native;
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!left) openExternal(web);
  }, 1500);
}

// ===== BOUTON RETOUR ANDROID =====
// Appelé par l'appli native (MainActivity) à chaque appui sur retour : on ferme
// ce qui est ouvert, puis on revient à l'accueil. Renvoie false seulement quand
// il n'y a plus rien à fermer et que l'agent a confirmé en appuyant deux fois.
let backExitArmed = false;
window.handleBack = function () {
  const modal = document.querySelector('.modal:not(.hidden)');
  if (modal) { closeModal(modal.id); return true; }
  if (document.getElementById('sidebar').classList.contains('open')) { toggleSidebar(); return true; }
  const onAuth = !document.getElementById('authScreen').classList.contains('hidden');
  if (onAuth && !document.getElementById('registerForm').classList.contains('hidden')) { showAuthTab('login'); return true; }
  if (!onAuth) {
    const active = document.querySelector('.view.active')?.id.replace('view-', '');
    if (active === 'checklist' && window.Checklist?.back()) return true;
    if (active === 'hospitals' && document.querySelector('.panel-detail.has-selected')) { backToList(); return true; }
    const home = userAccess.hidden.includes('hospitals')
      ? document.querySelector('.tab-item[data-view]:not(.hidden)')?.dataset.view
      : 'hospitals';
    if (home && active !== home) { showView(home); return true; }
  }
  if (!backExitArmed) {
    backExitArmed = true;
    showToast('Appuyez encore sur retour pour quitter');
    setTimeout(() => { backExitArmed = false; }, 2000);
    return true;
  }
  return false;
};

// Erreur inattendue : un message court plutôt qu'un bouton qui ne fait rien
window.addEventListener('error', e => showToast('Erreur : ' + (e.message || 'inconnue')));
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason && e.reason.message;
  if (msg && msg !== 'Session expirée') showToast('Erreur : ' + msg);
});

function showToast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.add('hidden'), 2000);
}

// ===== CHECK-LIST =====
async function loadChecklist() {
  try {
    const p = await api('/api/profile');
    window.Checklist?.setAph(p.aph);
  } catch {}
}

// ===== PROFIL =====
async function loadProfile() {
  document.getElementById('profileSuccess').classList.add('hidden');
  const p = await api('/api/profile');
  document.getElementById('profNom').value = p.nom || '';
  document.getElementById('profPrenom').value = p.prenom || '';
  document.getElementById('profEmail').value = p.email || '';
  document.getElementById('profAph').value = p.aph || '';
}

async function saveProfile(e) {
  e.preventDefault();
  try {
    await api('/api/profile', { method: 'PUT', body: JSON.stringify({ aph: document.getElementById('profAph').value }) });
    document.getElementById('profileSuccess').classList.remove('hidden');
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function telLink(phone, cls = 'tel-link') {
  if (!phone) return '';
  const clean = phone.replace(/[\s\.\-\(\)]/g, '');
  return `<a class="${cls}" href="tel:${clean}"><i class="ph ph-phone"></i> ${esc(phone)}</a>`;
}

document.addEventListener('click', e => {
  // Fermer sidebar si clic sur le contenu principal (mobile), sauf sur les
  // boutons qui l'ouvrent (sinon elle se refermerait aussitôt)
  if (window.innerWidth <= 768 && !e.target.closest('.sidebar, .hamburger, .tab-more')) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(el => closeModal(el.id));
  }
});

// Swipe gesture for sidebar on mobile
(function() {
  let startX = 0, startY = 0;
  document.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (window.innerWidth > 768) return;
    const sidebar = document.getElementById('sidebar');
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) > 100) return;
    if (!sidebar.classList.contains('open') && dx > 30) toggleSidebar();
    if (sidebar.classList.contains('open') && dx < -30) toggleSidebar();
  }, { passive: true });
})();

// ===== PROTOCOLS (Grande garde) =====
let allProtocols = [];

async function loadProtocols() {
  allProtocols = await api('/api/protocols');
  const container = document.getElementById('protocolList');
  const admin = isAdmin();
  if (!allProtocols.length) { container.innerHTML = '<div class="empty-state">Aucun protocole pour le moment.</div>'; return; }
  container.innerHTML = allProtocols.map(p => `
    <div class="gg-link-wrapper">
      <a class="gg-link" href="${esc(p.url)}" target="_blank" rel="noopener">
        <span class="gg-icon">${p.icon ? esc(p.icon) : '<i class="ph ph-file-pdf"></i>'}</span>
        <span class="gg-title">${esc(p.name)}</span>
        <i class="ph ph-arrow-right gg-arrow"></i>
      </a>
      ${admin ? `<div class="gg-admin">
        <button type="button" class="icon-btn" aria-label="Modifier" onclick="editProtocol(${p.id})"><i class="ph ph-pencil-simple"></i></button>
        <button type="button" class="icon-btn danger" aria-label="Supprimer" onclick="if(confirm('Supprimer ce protocole ?')) deleteProtocol(${p.id})"><i class="ph ph-trash"></i></button>
      </div>` : ''}
    </div>
  `).join('');
}

function showProtocolModal() {
  document.getElementById('protocolModalTitle').textContent = 'Ajouter un protocole';
  document.getElementById('pId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pIcon').value = '';
  document.getElementById('pUrl').value = '';
  document.getElementById('protocolModal').classList.remove('hidden');
}

async function editProtocol(id) {
  const p = allProtocols.find(x => x.id === id);
  if (!p) return;
  document.getElementById('protocolModalTitle').textContent = 'Modifier le protocole';
  document.getElementById('pId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pIcon').value = p.icon || '';
  document.getElementById('pUrl').value = p.url;
  document.getElementById('protocolModal').classList.remove('hidden');
}

async function saveProtocol(e) {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const data = {
    name: document.getElementById('pName').value,
    icon: document.getElementById('pIcon').value,
    url: document.getElementById('pUrl').value,
  };
  try {
    if (id) await api(`/api/protocols/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api('/api/protocols', { method: 'POST', body: JSON.stringify(data) });
    closeModal('protocolModal');
    loadProtocols();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function deleteProtocol(id) {
  await api(`/api/protocols/${id}`, { method: 'DELETE' });
  loadProtocols();
}

checkAuth();
