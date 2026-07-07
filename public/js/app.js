let selectedId = null;
let authToken = localStorage.getItem('token') || null;
let allHospitals = [];

function isAdmin() { return !!authToken; }

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { headers, ...opts }).then(async res => {
    if (res.status === 401) { logout(); throw new Error('Session expirée'); }
    if (!res.ok) { const e = await res.text(); throw new Error(e); }
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
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  const idx = ['inbox','hospitals','grandegarde','recherche','contact','infos'].indexOf(name);
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  if (name === 'hospitals') loadHospitals();
  if (name === 'inbox') loadInbox();
  if (name === 'grandegarde') loadProtocols();
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
  return false;
}

// ===== DARK MODE =====
if (localStorage.getItem('dark') === 'true') document.body.classList.add('dark');
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark'));
  updateDarkUI();
}
function updateDarkUI() {
  const dark = document.body.classList.contains('dark');
  document.getElementById('darkIcon').textContent = dark ? '☀️' : '🌙';
  document.getElementById('darkText').textContent = dark ? 'Light mode' : 'Dark mode';
}
updateDarkUI();

// ===== ADMIN =====
function toggleAdmin() {
  if (isAdmin()) { if (confirm('Se déconnecter ?')) logout(); }
  else {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
    setTimeout(() => document.getElementById('loginPassword').focus(), 100);
  }
}
function closeLogin() { document.getElementById('loginOverlay').classList.add('hidden'); }

async function doLogin() {
  try {
    const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('loginPassword').value }) });
    authToken = res.token;
    localStorage.setItem('token', res.token);
    closeLogin();
    updateAdminUI();
    if (selectedId) selectHospital(selectedId);
  } catch { document.getElementById('loginError').classList.remove('hidden'); }
}

function logout() {
  if (authToken) api('/api/logout', { method: 'POST' }).catch(() => {});
  authToken = null;
  localStorage.removeItem('token');
  updateAdminUI();
  backToList();
  loadHospitals();
  document.getElementById('hospitalDetail').innerHTML = `<div class="empty-detail"><div class="empty-icon">🏥</div><h3>Sélectionnez un hôpital</h3></div>`;
  selectedId = null;
}

function updateAdminUI() {
  const admin = isAdmin();
  document.getElementById('adminText').textContent = admin ? 'Admin ✓' : 'Admin';
  document.getElementById('adminToggle').classList.toggle('active', admin);
  document.getElementById('adminBadge').classList.toggle('hidden', !admin);
  document.getElementById('addBtn').style.display = admin ? '' : 'none';
  document.getElementById('addProtocolBtn').style.display = admin ? '' : 'none';
  document.getElementById('navInbox').classList.toggle('hidden', !admin);
  if (admin) loadInboxCount();
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
    <div class="hospital-card ${selectedId === h.id ? 'active' : ''}" onclick="selectHospital(${h.id})">
      <h3>${esc(h.name)}</h3>
      <div class="addr">${esc(h.address)}</div>
      ${h.phone ? `<div class="phone">📞 ${esc(h.phone)}</div>` : ''}
    </div>
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

  const groups = {};
  for (const s of h.services) {
    const site = s.building || 'Général';
    if (!groups[site]) groups[site] = [];
    groups[site].push(s);
  }
  let svcHTML = '';
  for (const [site, svcs] of Object.entries(groups)) {
    svcHTML += `<div class="site-group"><div class="section-title">${esc(site)}</div>`;
    svcHTML += svcs.map(s => `
      <div class="service-card">
        <div class="service-info">
          <h4>${esc(s.name)} ${s.floor ? `<span class="badge-floor">${esc(s.floor)}</span>` : ''}</h4>
          ${s.description ? `<p>${esc(s.description)}</p>` : ''}
          ${s.door_codes ? `<p>🔑 ${esc(s.door_codes)}</p>` : ''}
          ${s.phone ? `<p>${telLink(s.phone)}</p>` : ''}
        </div>
        ${admin ? `<div class="service-actions">
          <button onclick="showServiceModal(${h.id},${s.id})">✏️</button>
          <button onclick="deleteService(${s.id})">🗑️</button>
        </div>` : ''}
      </div>
    `).join('');
    svcHTML += '</div>';
  }
  const gps = (h.lat && h.lng) ? `
    <div class="detail-gps">
      <button class="btn btn-success btn-sm" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=driving','_blank')">📍 Google</button>
      <button class="btn btn-outline btn-sm" onclick="window.open('https://waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes','_blank')">🗺️ Waze</button>
    </div>` : '';
  document.getElementById('hospitalDetail').innerHTML = `
    <button class="mobile-back" onclick="backToList()">← Retour</button>
    <div class="detail-header">
      <h2>${esc(h.name)}</h2>
      <div class="detail-info">
        <div class="info-line"><span class="label">Adresse:</span> ${esc(h.address)}</div>
        <div class="info-line"><span class="label">Contact:</span> ${h.phone ? telLink(h.phone) : 'Non renseigné'}</div>
      </div>
      ${gps}
      ${admin ? `<div class="detail-admin">
        <button class="btn btn-primary btn-sm" onclick="showHospitalModal(${h.id})">✏️ Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="if(confirm('Supprimer cet hôpital ?')) deleteHospital(${h.id})">🗑️ Supprimer</button>
        <button class="btn btn-primary btn-sm" onclick="showServiceModal(${h.id})">+ Service</button>
      </div>` : ''}
    </div>
    <div class="services-section">${h.services.length === 0 ? '<div class="empty-state">Aucun service</div>' : svcHTML}</div>`;
  renderHospitalList('');
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
        container.innerHTML = hs.length === 0 ? '<div class="empty-state">Aucun résultat</div>'
          : hs.map(h => `<div class="result-card" onclick="selectHospital(${h.id})"><h4>${esc(h.name)}</h4><p>${esc(h.address)}</p></div>`).join('');
      });
    } else {
      container.innerHTML = results.map(h =>
        `<div class="result-card" onclick="selectHospital(${h.id})"><h4>${esc(h.name)}</h4><p>${esc(h.address)}</p></div>`
      ).join('');
    }
  }, 200);
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
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();if(confirm('Supprimer ?')) deleteMessage(${m.id})">🗑️</button>
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

// ===== MODALS =====
function showHospitalModal(id) {
  document.getElementById('hospitalModalTitle').textContent = id ? 'Modifier' : 'Ajouter un hôpital';
  document.getElementById('hId').value = id || '';
  if (id) {
    api(`/api/hospitals/${id}`).then(h => {
      document.getElementById('hName').value = h.name;
      document.getElementById('hAddress').value = h.address;
      document.getElementById('hPhone').value = h.phone;
      document.getElementById('hLat').value = h.lat;
      document.getElementById('hLng').value = h.lng;
    });
  } else { ['hName','hAddress','hPhone','hLat','hLng'].forEach(id => document.getElementById(id).value = ''); }
  document.getElementById('hospitalModal').classList.remove('hidden');
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
  document.getElementById('hospitalDetail').innerHTML = `<div class="empty-detail"><div class="empty-icon">🏥</div><h3>Sélectionnez un hôpital</h3></div>`;
  loadHospitals();
}

function showServiceModal(hospitalId, serviceId) {
  document.getElementById('serviceModalTitle').textContent = serviceId ? 'Modifier' : 'Ajouter un service';
  document.getElementById('sHospitalId').value = hospitalId;
  document.getElementById('sId').value = serviceId || '';
  if (serviceId) {
    api(`/api/hospitals/${hospitalId}`).then(h => {
      const s = h.services.find(sv => sv.id === serviceId);
      if (s) {
        document.getElementById('sName').value = s.name;
        document.getElementById('sBuilding').value = s.building || '';
        document.getElementById('sFloor').value = s.floor || '';
        document.getElementById('sDoorCodes').value = s.door_codes || '';
        document.getElementById('sDescription').value = s.description || '';
        document.getElementById('sPhone').value = s.phone || '';
      }
    });
  } else {
    ['sName','sBuilding','sFloor','sDoorCodes','sDescription','sPhone'].forEach(id => document.getElementById(id).value = '');
  }
  document.getElementById('serviceModal').classList.remove('hidden');
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

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function telLink(phone) {
  if (!phone) return '';
  const clean = phone.replace(/[\s\.\-\(\)]/g, '');
  return `<a href="tel:${clean}" style="color:inherit;text-decoration:none">📞 ${esc(phone)}</a>`;
}

document.addEventListener('click', e => {
  // Fermer sidebar si clic sur le contenu principal (mobile)
  if (window.innerWidth <= 768 && !e.target.closest('.sidebar') && !e.target.closest('.hamburger')) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
  if (e.target.classList.contains('login-overlay')) closeLogin();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden), .login-overlay:not(.hidden)').forEach(el => {
      if (el.classList.contains('modal')) closeModal(el.id);
      if (el.classList.contains('login-overlay')) closeLogin();
    });
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
  container.innerHTML = allProtocols.map(p => `
    <div class="gg-link-wrapper" style="position:relative">
      <a class="gg-link" href="${esc(p.url)}" target="_blank" rel="noopener">
        <span class="gg-icon">${p.icon || '📄'}</span>
        <span class="gg-title">${esc(p.name)}</span>
        <span class="gg-arrow">→</span>
      </a>
      ${admin ? `<div style="position:absolute;top:4px;right:4px;display:flex;gap:4px">
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editProtocol(${p.id})">✏️</button>
        <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();if(confirm('Supprimer ce protocole ?')) deleteProtocol(${p.id})">🗑️</button>
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

updateAdminUI();
loadHospitals();
