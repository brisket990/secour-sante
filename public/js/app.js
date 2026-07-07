let selectedId = null;

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- Recherche ---
let searchTimer;
function searchHospitals() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadHospitals, 300);
}

// --- Liste des hôpitaux ---
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
      <h3>${escapeHtml(h.name)}</h3>
      <p>${escapeHtml(h.address)}</p>
      <p style="font-size:0.8rem;color:#718096">${h.phone || 'Tél. non renseigné'}</p>
    </div>
  `).join('');
}

// --- Détail d'un hôpital ---
async function selectHospital(id) {
  selectedId = id;
  const h = await api(`/api/hospitals/${id}`);
  const detail = document.getElementById('hospitalDetail');
  detail.classList.remove('hidden');

  let coords = '';
  if (h.lat && h.lng) {
    coords = `
      <div class="detail-actions">
        <button class="btn btn-success" onclick="openGPS(${h.lat}, ${h.lng}, '${escapeHtml(h.name)}')">📍 Naviguer (GPS)</button>
        <button class="btn btn-secondary btn-sm" onclick="openGPSWaze(${h.lat}, ${h.lng})">🗺️ Waze</button>
      </div>`;
  }

  detail.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(h.name)}</h2>
      <p>📌 ${escapeHtml(h.address)}</p>
      <p>📞 ${h.phone || 'Non renseigné'}</p>
      ${coords}
      <div class="detail-actions">
        <button class="btn btn-primary btn-sm" onclick="showHospitalModal(${h.id})">✏️ Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteHospital(${h.id})">🗑️ Supprimer</button>
        <button class="btn btn-primary btn-sm" onclick="showServiceModal(${h.id})">+ Ajouter un service</button>
      </div>
    </div>
    <h3 style="margin-bottom:0.8rem;color:#2d3748">Services</h3>
    <div id="servicesList">
      ${h.services.length === 0 ? '<div class="empty-state"><p>Aucun service renseigné</p></div>' :
        h.services.map(s => `
          <div class="service-card">
            <div class="service-info">
              <h4>${escapeHtml(s.name)} ${s.floor ? `<span class="badge">📍 ${escapeHtml(s.floor)}</span>` : ''}</h4>
              ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ''}
              ${s.phone ? `<p>📞 ${escapeHtml(s.phone)}</p>` : ''}
            </div>
            <div class="service-actions">
              <button onclick="showServiceModal(${h.id}, ${s.id})">✏️</button>
              <button onclick="deleteService(${s.id})">🗑️</button>
            </div>
          </div>
        `).join('')}
    </div>
  `;
  loadHospitals();
}

// --- GPS ---
function openGPS(lat, lng, name) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, '_blank');
}

function openGPSWaze(lat, lng) {
  const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.open(url, '_blank');
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

// --- Utilitaires ---
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Fermer modals en cliquant dehors ---
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.add('hidden');
  }
});

// --- Initialisation ---
loadHospitals();
