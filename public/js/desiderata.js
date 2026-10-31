// Desiderata : l'agent touche un jour du calendrier et choisit son OFF (jour,
// nuit ou les deux). Les règles (mois ouverts, maximum par mois et à la suite)
// sont vérifiées par le serveur. Vue Planning : grille du mois et exports.
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const TYPE_ICONS = { jour: 'ph-sun', nuit: 'ph-moon-stars', both: 'ph-circle-half' };

const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_FR[m - 1]} ${y}`; };
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const weekdayOf = day => new Date(day + 'T00:00:00Z').getUTCDay();
const pad = n => String(n).padStart(2, '0');
const shiftMonth = (ym, n) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);

// ===== Agent =====
let de = null;       // { settings, types, months, days }
let deMonth = null;
let deDay = null;

async function loadDesiderata() {
  try {
    de = await api('/api/planning/me');
  } catch (err) {
    document.querySelector('#view-desiderata .de-wrap').classList.add('hidden');
    return;
  }
  document.querySelector('#view-desiderata .de-wrap').classList.remove('hidden');
  const s = de.settings;
  document.getElementById('deRules').textContent =
    `Touchez un jour pour le demander en OFF. Jusqu'à ${s.max_per_month} jours par mois, ${s.max_consecutive} à la suite au maximum.`;
  if (!de.months.includes(deMonth)) deMonth = de.months[0];
  renderDesiderata();
}

function renderDesiderata() {
  const tabs = document.getElementById('deMonths');
  tabs.innerHTML = de.months.map(m => `
    <button type="button" role="tab" class="seg-item ${m === deMonth ? 'active' : ''}" aria-selected="${m === deMonth}" onclick="deSelectMonth('${m}')">${monthLabel(m)}</button>
  `).join('');

  const n = daysIn(deMonth);
  const offset = (weekdayOf(`${deMonth}-01`) + 6) % 7; // lundi en premier
  const count = Object.keys(de.days).filter(d => d.startsWith(deMonth)).length;
  const max = de.settings.max_per_month;
  document.getElementById('deMonthTitle').textContent = monthLabel(deMonth);
  const countEl = document.getElementById('deCount');
  countEl.textContent = `${count} / ${max} jours OFF`;
  countEl.classList.toggle('full', count >= max);

  let html = '<span class="de-pad"></span>'.repeat(offset);
  for (let d = 1; d <= n; d++) {
    const day = `${deMonth}-${pad(d)}`;
    const type = de.days[day];
    const wd = weekdayOf(day);
    html += `<button type="button" class="de-day ${type ? 'is-off off-' + type : ''} ${wd === 0 || wd === 6 ? 'weekend' : ''}"
      onclick="openDaySheet('${day}')" aria-label="${DAYS_FR[wd]} ${d}${type ? ', OFF ' + de.types[type].label : ''}">
      <span class="de-num">${d}</span>${type ? `<span class="de-code">${de.types[type].code}</span>` : ''}
    </button>`;
  }
  document.getElementById('deGrid').innerHTML = html;
  document.getElementById('deLegend').innerHTML = de.settings.types.map(t =>
    `<span class="de-legend-item"><span class="de-swatch off-${t}"></span>${de.types[t].code} : ${esc(de.types[t].label)}</span>`
  ).join('');
}

function deSelectMonth(m) { deMonth = m; renderDesiderata(); }

function openDaySheet(day) {
  deDay = day;
  const current = de.days[day];
  const d = Number(day.slice(8));
  document.getElementById('daySheetTitle').textContent = `${DAYS_FR[weekdayOf(day)].replace(/^./, c => c.toUpperCase())} ${d} ${MONTHS_FR[+day.slice(5, 7) - 1].toLowerCase()}`;
  document.getElementById('daySheetError').classList.add('hidden');
  const opts = de.settings.types.map(t => `
    <button type="button" class="sheet-option ${current === t ? 'selected' : ''}" onclick="setDesiderata('${t}')">
      <i class="ph ${TYPE_ICONS[t]}"></i><span>OFF ${esc(de.types[t].label.toLowerCase())}</span>${current === t ? '<i class="ph ph-check sheet-check"></i>' : ''}
    </button>`).join('');
  document.getElementById('daySheetOptions').innerHTML = opts + (current
    ? `<button type="button" class="sheet-option danger" onclick="setDesiderata(null)"><i class="ph ph-trash"></i><span>Retirer ce jour</span></button>`
    : '');
  document.getElementById('daySheet').classList.remove('hidden');
}

async function setDesiderata(type) {
  try {
    await api(`/api/planning/me/${deDay}`, { method: 'PUT', body: JSON.stringify({ type }) });
    if (type) de.days[deDay] = type; else delete de.days[deDay];
    closeModal('daySheet');
    renderDesiderata();
  } catch (err) {
    const e = document.getElementById('daySheetError');
    e.textContent = err.message;
    e.classList.remove('hidden');
  }
}

// ===== Planning (admin et planificateur) =====
let plMonth = null;

async function loadPlanning() {
  if (!plMonth) {
    const { openMonths } = await api('/api/planning/settings');
    plMonth = openMonths[0];
  }
  document.getElementById('plMonthLabel').textContent = monthLabel(plMonth);
  const wrap = document.getElementById('plTable');
  const data = await api(`/api/planning/month/${plMonth}`);
  const byUser = {};
  for (const e of data.entries) (byUser[e.user_id] ||= {})[Number(e.day.slice(8))] = e.type;
  const totals = Array(data.days + 1).fill(0);
  const dayCols = Array.from({ length: data.days }, (_, i) => i + 1);
  const we = d => [0, 6].includes(weekdayOf(`${plMonth}-${pad(d)}`));

  const rows = data.users.map(u => {
    const days = byUser[u.id] || {};
    const cells = dayCols.map(d => {
      const t = days[d];
      if (t) totals[d]++;
      return `<td class="${we(d) ? 'weekend' : ''} ${t ? 'off-' + t : ''}">${t ? data.types[t].code : ''}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(u.nom)} ${esc(u.prenom)}</th>${cells}<td class="pl-total">${Object.keys(days).length || ''}</td></tr>`;
  }).join('');

  wrap.innerHTML = data.users.length === 0 ? '<div class="empty-state">Aucun agent validé pour le moment.</div>' : `
    <table class="pl-table">
      <thead><tr><th scope="col">Agent</th>${dayCols.map(d => `<th scope="col" class="${we(d) ? 'weekend' : ''}"><span>${'DLMMJVS'[weekdayOf(`${plMonth}-${pad(d)}`)]}</span>${d}</th>`).join('')}<th scope="col">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">Agents en OFF</th>${dayCols.map(d => `<td class="${we(d) ? 'weekend' : ''}">${totals[d] || ''}</td>`).join('')}<td></td></tr></tfoot>
    </table>`;

  const settingsBox = document.getElementById('plSettings');
  settingsBox.classList.toggle('hidden', !isAdmin());
  if (isAdmin()) loadPlanningSettings();
}

function planningShift(n) { plMonth = shiftMonth(plMonth, n); loadPlanning(); }

async function exportPlanning(fmt) {
  try {
    const { token } = await api('/api/planning/export-token', { method: 'POST', body: JSON.stringify({ month: plMonth }) });
    const url = `${location.origin}/export/planning/${plMonth}.${fmt}?token=${encodeURIComponent(token)}`;
    if (isNativeApp()) {
      // Dans l'appli, un lien vers ce même site resterait dans la WebView, qui ne sait
      // pas télécharger. En http, Capacitor le confie au navigateur du téléphone,
      // et le serveur le redirige vers https.
      openExternal(url.replace(/^https:/, 'http:'));
    } else {
      window.location.href = url;
    }
  } catch (err) {
    alert('Export impossible : ' + err.message);
  }
}

async function loadPlanningSettings() {
  const { settings } = await api('/api/planning/settings');
  document.getElementById('setOpenFrom').value = settings.open_from;
  document.getElementById('setOpenTo').value = settings.open_to;
  document.getElementById('setMaxMonth').value = settings.max_per_month;
  document.getElementById('setMaxRun').value = settings.max_consecutive;
  document.querySelectorAll('input[name="setTypes"]').forEach(c => { c.checked = settings.types.includes(c.value); });
  document.getElementById('plSettingsError').classList.add('hidden');
  document.getElementById('plSettingsSuccess').classList.add('hidden');
}

async function savePlanningSettings(e) {
  e.preventDefault();
  const err = document.getElementById('plSettingsError');
  const ok = document.getElementById('plSettingsSuccess');
  err.classList.add('hidden'); ok.classList.add('hidden');
  try {
    await api('/api/planning/settings', { method: 'PUT', body: JSON.stringify({
      open_from: document.getElementById('setOpenFrom').value,
      open_to: document.getElementById('setOpenTo').value,
      max_per_month: document.getElementById('setMaxMonth').value,
      max_consecutive: document.getElementById('setMaxRun').value,
      types: [...document.querySelectorAll('input[name="setTypes"]:checked')].map(c => c.value),
    }) });
    ok.classList.remove('hidden');
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}
