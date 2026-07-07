let selectedId = null;
let authToken = localStorage.getItem('token') || null;

function isAdmin() { return !!authToken; }

function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { headers, ...opts }).then(async res => {
    if (res.status === 401) { logout(); throw new Error('Session expirée'); }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

// ===== SIDEBAR & VIEWS =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  const navItems = document.querySelectorAll('.nav-item');
  const idx = ['hospitals','recherche','infos'].indexOf(name);
  if (navItems[idx]) navItems[idx].classList.add('active');
  if (name === 'hospitals') loadHospitals();
  if (window.innerWidth <= 768) { toggleSidebar(); }
  return false;
}

// ===== ADMIN =====
function toggleAdmin() {
  if (isAdmin()) {
    if (confirm('Se déconnecter ?')) logout();
  } else {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('hidden');
    setTimeout(() => document.getElementById('loginPassword').focus(), 100);
  }
}

function closeLogin() {
  document.getElementById('loginOverlay').classList.add('hidden');
}

async function doLogin() {
  const password = document.getElementById('loginPassword').value;
  try {
    const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
    authToken = res.token;
    localStorage.setItem('token', res.token);
    closeLogin();
    updateAdminUI();
    if (selectedId) selectHospital(selectedId);
  } catch {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function logout() {
  if (authToken) api('/api/logout', { method: 'POST' }).catch(() => {});
  authToken = null;
  localStorage.removeItem('token');
  updateAdminUI();
  loadHospitals();
  document.getElementById('hospitalDetail').innerHTML = `
    <div class="empty-detail">
      <div class="empty-icon">🏥</div>
      <h3>Sélectionnez un établissement</h3>
      <p>Cliquez sur un hôpital dans la liste pour consulter sa fiche technique</p>
    </div>`;
  selectedId = null;
}

function updateAdminUI() {
  const admin = isAdmin();
  document.getElementById('adminText').textContent = admin ? 'Admin ✓' : 'Admin';
  document.getElementById('adminToggle').classList.toggle('active', admin);
  document.getElementById('adminBadge').classList.toggle('hidden', !admin);
  document.getElementById('addBtn').style.display = admin ? 'inline-flex' : 'none';
}

// ===== SEARCH =====
let searchTimer;
function searchHospitals() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadHospitals, 250);
}

async function loadHospitals() {
  const search = document.getElementById('searchInput').value;
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const hospitals = await api(`/api/hospitals${q}`);
  const container = document.getElementById('hospitalList');
  document.getElementById('hospitalCount').textContent = hospitals.length;
  document.getElementById('subtitleHospitals').textContent = hospitals.length === 0 ? 'Aucun résultat' : `${hospitals.length} établissement${hospitals.length > 1 ? 's' : ''} trouvé${hospitals.length > 1 ? 's' : ''}`;
  if (hospitals.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun établissement trouvé</div>';
    return;
  }
  container.innerHTML = hospitals.map(h => `
    <div class="hospital-card ${selectedId === h.id ? 'active' : ''}" onclick="selectHospital(${h.id})">
      <h3>${esc(h.name)}</h3>
      <div class="addr">${esc(h.address)}</div>
      ${h.phone ? `<div class="phone">📞 ${esc(h.phone)}</div>` : ''}
    </div>
  `).join('');
}

async function selectHospital(id) {
  selectedId = id;
  showView('hospitals');
  const h = await api(`/api/hospitals/${id}`);
  const detail = document.getElementById('hospitalDetail');
  const admin = isAdmin();

  let gps = '';
  if (h.lat && h.lng) {
    gps = `<div class="detail-gps">
      <button class="btn btn-success btn-sm" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=driving','_blank')">📍 Navigation Google Maps</button>
      <button class="btn btn-outline btn-sm" onclick="window.open('https://waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes','_blank')">🗺️ Waze</button>
    </div>`;
  }

  let adminActions = '';
  if (admin) {
    adminActions = `<div class="detail-admin">
      <button class="btn btn-primary btn-sm" onclick="showHospitalModal(${h.id})">✏️ Modifier fiche</button>
      <button class="btn btn-danger btn-sm" onclick="deleteHospital(${h.id})">🗑️ Supprimer</button>
      <button class="btn btn-primary btn-sm" onclick="showServiceModal(${h.id})">+ Ajouter service</button>
    </div>`;
  }

  detail.innerHTML = `
    <div class="detail-header">
      <h2>${esc(h.name)}</h2>
      <div class="detail-info">
        <div class="info-line"><span class="label">Adresse:</span> <span>${esc(h.address)}</span></div>
        <div class="info-line"><span class="label">Contact:</span> <span>${h.phone || 'Non renseigné'}</span></div>
      </div>
      ${gps}
      ${adminActions}
    </div>
    <div class="services-section">
      <div class="section-title">Services de Réanimation & Urgences</div>
      ${h.services.length === 0 ? '<div class="empty-state">Aucun service renseigné</div>' :
        h.services.map(s => `
          <div class="service-card">
            <div class="service-info">
              <h4>${esc(s.name)} ${s.floor ? `<span class="badge-floor">${esc(s.floor)}</span>` : ''}</h4>
              ${s.description ? `<p>${esc(s.description)}</p>` : ''}
              ${s.phone ? `<p>📞 ${esc(s.phone)}</p>` : ''}
            </div>
            ${admin ? `<div class="service-actions">
              <button onclick="showServiceModal(${h.id}, ${s.id})">✏️</button>
              <button onclick="deleteService(${s.id})">🗑️</button>
            </div>` : ''}
          </div>
        `).join('')}
    </div>
  `;
  loadHospitals();
}

// ===== QUICK SEARCH =====
let quickTimer;
function quickSearch() {
  clearTimeout(quickTimer);
  quickTimer = setTimeout(async () => {
    const q = document.getElementById('quickSearchInput').value.trim();
    const container = document.getElementById('quickResults');
    if (!q) { container.innerHTML = ''; return; }
    const hospitals = await api(`/api/hospitals?search=${encodeURIComponent(q)}`);
    if (hospitals.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun résultat trouvé</div>';
      return;
    }
    container.innerHTML = hospitals.map(h => `
      <div class="result-card" onclick="selectHospital(${h.id})">
        <h4>${esc(h.name)}</h4>
        <p>${esc(h.address)}</p>
        <span class="result-tag">${h.phone || ''}</span>
      </div>
    `).join('');
  }, 250);
}

// ===== MODALS =====
function showHospitalModal(id) {
  document.getElementById('hospitalModalTitle').textContent = id ? 'Modifier l\'établissement' : 'Ajouter un établissement';
  document.getElementById('hId').value = id || '';
  if (id) {
    api(`/api/hospitals/${id}`).then(h => {
      document.getElementById('hName').value = h.name;
      document.getElementById('hAddress').value = h.address;
      document.getElementById('hPhone').value = h.phone;
      document.getElementById('hLat').value = h.lat;
      document.getElementById('hLng').value = h.lng;
    });
  } else {
    ['hName','hAddress','hPhone','hLat','hLng'].forEach(id => document.getElementById(id).value = '');
  }
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
  if (id) {
    await api(`/api/hospitals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await api('/api/hospitals', { method: 'POST', body: JSON.stringify(data) });
  }
  closeModal('hospitalModal');
  selectedId = id ? parseInt(id) : null;
  if (selectedId) selectHospital(selectedId);
  loadHospitals();
}

async function deleteHospital(id) {
  if (!confirm('Supprimer cet établissement et tous ses services ?')) return;
  await api(`/api/hospitals/${id}`, { method: 'DELETE' });
  selectedId = null;
  document.getElementById('hospitalDetail').innerHTML = `<div class="empty-detail"><div class="empty-icon">🏥</div><h3>Sélectionnez un établissement</h3><p>Cliquez sur un hôpital dans la liste pour consulter sa fiche technique</p></div>`;
  loadHospitals();
}

function showServiceModal(hospitalId, serviceId) {
  document.getElementById('serviceModalTitle').textContent = serviceId ? 'Modifier le service' : 'Ajouter un service';
  document.getElementById('sHospitalId').value = hospitalId;
  document.getElementById('sId').value = serviceId || '';
  if (serviceId) {
    api(`/api/hospitals/${hospitalId}`).then(h => {
      const s = h.services.find(sv => sv.id === serviceId);
      if (s) {
        document.getElementById('sName').value = s.name;
        document.getElementById('sFloor').value = s.floor;
        document.getElementById('sDescription').value = s.description;
        document.getElementById('sPhone').value = s.phone;
      }
    });
  } else {
    ['sName','sFloor','sDescription','sPhone'].forEach(id => document.getElementById(id).value = '');
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
    floor: document.getElementById('sFloor').value,
    description: document.getElementById('sDescription').value,
    phone: document.getElementById('sPhone').value,
  };
  if (id) {
    await api(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await api('/api/services', { method: 'POST', body: JSON.stringify(data) });
  }
  closeModal('serviceModal');
  selectHospitals(parseInt(hospitalId));
}

async function deleteService(id) {
  if (!confirm('Supprimer ce service ?')) return;
  const hId = selectedId;
  await api(`/api/services/${id}`, { method: 'DELETE' });
  if (hId) selectHospital(hId);
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
  if (e.target.classList.contains('login-overlay')) closeLogin();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden), .login-overlay:not(.hidden)').forEach(el => {
      if (el.classList.contains('modal')) closeModal(el.id);
      if (el.classList.contains('login-overlay')) closeLogin();
    });
  }
});

updateAdminUI();
loadHospitals();
