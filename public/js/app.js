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

// --- Admin ---
function toggleAdmin() {
  if (isAdmin()) {
    if (confirm('Se déconnecter ?')) logout();
  } else {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginPassword').focus();
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
    document.getElementById('loginError').style.display = 'block';
  }
}

function logout() {
  if (authToken) {
    api('/api/logout', { method: 'POST' }).catch(() => {});
  }
  authToken = null;
  localStorage.removeItem('token');
  updateAdminUI();
  loadHospitals();
  document.getElementById('hospitalDetail').classList.add('hidden');
  selectedId = null;
}

function updateAdminUI() {
  const admin = isAdmin();
  document.getElementById('adminToggle').textContent = admin ? '🔓 Admin' : '🔑 Admin';
  document.getElementById('adminToggle').className = 'admin-btn' + (admin ? ' active' : '');
  document.getElementById('adminStatus').classList.toggle('hidden', !admin);
  document.getElementById('addHospitalBtn').classList.toggle('hidden', !admin);
  if (selectedId) selectHospital(selectedId);
}

// --- Recherche ---
let searchTimer;
function searchHospitals() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadHospitals, 300);
}

// --- Liste ---
async function loadHospitals() {
  const search = document.getElementById('searchInput').value;
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  const hospitals = await api(`/api/hospitals${q}`);
  const container = document.getElementById('hospitalList');
  if (hospitals.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Aucun hôpital trouvé</p></div>';
    return;
  }
  container.innerHTML = hospitals.map(h => `
    <div class="hospital-card ${selectedId === h.id ? 'active' : ''}" onclick="selectHospital(${h.id})">
      <h3>${esc(h.name)}</h3>
      <div class="addr">${esc(h.address)}</div>
      <div class="phone">${h.phone || ''}</div>
    </div>
  `).join('');
}

// --- Détail ---
async function selectHospital(id) {
  selectedId = id;
  const h = await api(`/api/hospitals/${id}`);
  const detail = document.getElementById('hospitalDetail');
  detail.classList.remove('hidden');

  let gpsBtns = '';
  if (h.lat && h.lng) {
    gpsBtns = `
      <div class="detail-actions">
        <button class="btn btn-success btn-sm" onclick="openGPS(${h.lat}, ${h.lng}, '${escAttr(h.name)}')">📍 Naviguer</button>
        <button class="btn btn-outline btn-sm" onclick="openGPSWaze(${h.lat}, ${h.lng})">🗺️ Waze</button>
      </div>`;
  }

  const admin = isAdmin();
  const adminActions = admin ? `
    <div class="detail-actions">
      <button class="btn btn-primary btn-sm" onclick="showHospitalModal(${h.id})">✏️ Modifier</button>
      <button class="btn btn-danger btn-sm" onclick="deleteHospital(${h.id})">🗑️ Supprimer</button>
      <button class="btn btn-primary btn-sm" onclick="showServiceModal(${h.id})">+ Ajouter un service</button>
    </div>` : '';

  detail.innerHTML = `
    <div class="detail-header">
      <h2>${esc(h.name)}</h2>
      <div class="info-line"><span class="icon">📍</span> ${esc(h.address)}</div>
      <div class="info-line"><span class="icon">📞</span> ${h.phone || 'Non renseigné'}</div>
      ${gpsBtns}
      ${adminActions}
    </div>
    <div class="services-section">
      <h3>Services</h3>
      <div id="servicesList">
        ${h.services.length === 0 ? '<div class="empty-state"><p>Aucun service renseigné</p></div>' :
          h.services.map(s => `
            <div class="service-card">
              <div class="service-info">
                <h4>${esc(s.name)} ${s.floor ? `<span class="badge">📍 ${esc(s.floor)}</span>` : ''}</h4>
                ${s.description ? `<p>${esc(s.description)}</p>` : ''}
                ${s.phone ? `<p>📞 ${esc(s.phone)}</p>` : ''}
              </div>
              ${admin ? `
              <div class="service-actions">
                <button onclick="showServiceModal(${h.id}, ${s.id})">✏️</button>
                <button onclick="deleteService(${s.id})">🗑️</button>
              </div>` : ''}
            </div>
          `).join('')}
      </div>
    </div>
  `;
  loadHospitals();
}

// --- GPS ---
function openGPS(lat, lng, name) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
}
function openGPSWaze(lat, lng) {
  window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
}

// --- Modal Hôpital ---
function showHospitalModal(id) {
  document.getElementById('hospitalModalTitle').textContent = id ? 'Modifier l\'hôpital' : 'Ajouter un hôpital';
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
  if (!confirm('Supprimer cet hôpital et tous ses services ?')) return;
  await api(`/api/hospitals/${id}`, { method: 'DELETE' });
  selectedId = null;
  document.getElementById('hospitalDetail').classList.add('hidden');
  loadHospitals();
}

// --- Modal Service ---
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
  selectHospital(parseInt(hospitalId));
}

async function deleteService(id) {
  if (!confirm('Supprimer ce service ?')) return;
  const hId = selectedId;
  await api(`/api/services/${id}`, { method: 'DELETE' });
  if (hId) selectHospital(hId);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function escAttr(str) {
  return str.replace(/['"&<>]/g, c => ({ "'": '&#39;', '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) e.target.classList.add('hidden');
  if (e.target.classList.contains('login-overlay')) closeLogin();
});

updateAdminUI();
loadHospitals();
