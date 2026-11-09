// Desiderata : l'agent touche un jour du calendrier et choisit son OFF (jour,
// nuit ou les deux). Les règles (mois ouverts, maximum par mois et à la suite)
// sont vérifiées par le serveur. Les vacances déjà posées (sur Gestime) se
// signalent aussi, à titre d'information : elles ne comptent pas dans les OFF.
// Vue Planning : grille du mois et exports.
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const TYPE_ICONS = { jour: 'ph-sun', nuit: 'ph-moon-stars', both: 'ph-circle-half', vacances: 'ph-airplane-tilt' };
const isOffType = (types, t) => !!types[t] && !types[t].info;

const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_FR[m - 1]} ${y}`; };
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const weekdayOf = day => new Date(day + 'T00:00:00Z').getUTCDay();
const pad = n => String(n).padStart(2, '0');
const longDate = day => `${Number(day.slice(8))} ${MONTHS_FR[+day.slice(5, 7) - 1].toLowerCase()} ${day.slice(0, 4)}`;
const shortDate = day => `${day.slice(8)}/${day.slice(5, 7)}`;
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
  // Jusqu'à 24 mois ouverts : flèches mois par mois, ou liste pour sauter loin.
  // Les mois où l'agent a déjà posé des OFF sont signalés dans la liste.
  // Dates butoir des mois ouverts : bandeau en haut, chaque mois cliquable
  const deadlines = de.settings.deadlines || {};
  const withDeadline = de.months.filter(m => deadlines[m]);
  const banner = document.getElementById('deDeadlines');
  banner.classList.toggle('hidden', !withDeadline.length);
  banner.innerHTML = `<i class="ph ph-hourglass-medium"></i><div><strong>${withDeadline.length > 1 ? 'Dates butoir' : 'Date butoir'}</strong>
    <ul>${withDeadline.map(m => `<li><button type="button" class="de-dl-link" onclick="deSelectMonth('${m}')">${monthLabel(m)}</button> : saisie jusqu'au ${longDate(deadlines[m])} inclus</li>`).join('')}</ul>
    <span class="de-dl-after">Après cette date, le mois n'est plus modifiable.</span></div>`;
  const select = document.getElementById('deMonthSelect');
  select.innerHTML = de.months.map(m => {
    const inMonth = Object.entries(de.days).filter(([d]) => d.startsWith(m));
    const off = inMonth.filter(([, t]) => isOffType(de.types, t)).length;
    const vac = inMonth.length - off;
    const marks = [off && `${off} OFF`, vac && 'vac.'].filter(Boolean).join(' + ');
    const dl = deadlines[m] ? ` · avant le ${shortDate(deadlines[m])}` : '';
    return `<option value="${m}" ${m === deMonth ? 'selected' : ''}>${monthLabel(m)}${marks ? ` (${marks})` : ''}${dl}</option>`;
  }).join('');
  const idx = de.months.indexOf(deMonth);
  document.getElementById('dePrev').disabled = idx <= 0;
  document.getElementById('deNext').disabled = idx >= de.months.length - 1;

  const n = daysIn(deMonth);
  const offset = (weekdayOf(`${deMonth}-01`) + 6) % 7; // lundi en premier
  const count = Object.entries(de.days).filter(([d, t]) => d.startsWith(deMonth) && isOffType(de.types, t)).length;
  const max = de.settings.max_per_month;
  document.getElementById('deMonthTitle').textContent = monthLabel(deMonth);
  const countEl = document.getElementById('deCount');
  countEl.textContent = `${count} / ${max} jours OFF`;
  countEl.classList.toggle('full', count >= max);
  const deadline = (de.settings.deadlines || {})[deMonth];
  const dlEl = document.getElementById('deDeadline');
  dlEl.classList.toggle('hidden', !deadline);
  if (deadline) dlEl.innerHTML = `<i class="ph ph-hourglass-medium"></i> Saisie possible jusqu'au ${longDate(deadline)} inclus`;

  let html = '<span class="de-pad"></span>'.repeat(offset);
  for (let d = 1; d <= n; d++) {
    const day = `${deMonth}-${pad(d)}`;
    const type = de.days[day];
    const wd = weekdayOf(day);
    html += `<button type="button" class="de-day ${type ? 'is-off off-' + type : ''} ${wd === 0 || wd === 6 ? 'weekend' : ''}"
      onclick="openDaySheet('${day}')" aria-label="${DAYS_FR[wd]} ${d}${type === 'vacances' ? ', vacances' : type ? ', OFF ' + de.types[type].label : ''}">
      <span class="de-num">${d}</span>${type ? `<span class="de-code">${de.types[type].code}</span>` : ''}
    </button>`;
  }
  document.getElementById('deGrid').innerHTML = html;
  document.getElementById('deLegend').innerHTML = [...de.settings.types, 'vacances'].map(t =>
    `<span class="de-legend-item"><span class="de-swatch off-${t}"></span>${de.types[t].code} : ${esc(de.types[t].label)}</span>`
  ).join('');
}

function deSelectMonth(m) { deMonth = m; renderDesiderata(); }

function deShiftMonth(n) {
  const i = de.months.indexOf(deMonth) + n;
  if (i >= 0 && i < de.months.length) deSelectMonth(de.months[i]);
}

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
  const vac = current === 'vacances';
  const run = vac ? vacationRun(day) : [];
  document.getElementById('daySheetOptions').innerHTML = opts + `
    <div class="sheet-sep">Vacances déjà posées</div>
    <button type="button" class="sheet-option vac ${vac ? 'selected' : ''}" onclick="setDesiderata('vacances')">
      <i class="ph ${TYPE_ICONS.vacances}"></i><span>En vacances ce jour</span>${vac ? '<i class="ph ph-check sheet-check"></i>' : ''}
    </button>
    <p class="vac-notice small"><i class="ph ph-info"></i><span>Information seulement. Les demandes de vacances se font sur Gestime, pas ici.</span></p>` +
    (current ? `<button type="button" class="sheet-option danger" onclick="setDesiderata(null)"><i class="ph ph-trash"></i><span>Retirer ce jour</span></button>` : '') +
    (run.length > 1 ? `<button type="button" class="sheet-option danger" onclick="removeVacationPeriod('${run[0]}', '${run[run.length - 1]}')"><i class="ph ph-trash"></i><span>Retirer toutes ces vacances (${run.length} jours)</span></button>` : '');
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

// Jours de vacances consécutifs autour de `day`
function vacationRun(day) {
  const shift = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  let from = day, to = day;
  while (de.days[shift(from, -1)] === 'vacances') from = shift(from, -1);
  while (de.days[shift(to, 1)] === 'vacances') to = shift(to, 1);
  const out = [];
  for (let d = from; d <= to; d = shift(d, 1)) out.push(d);
  return out;
}

async function removeVacationPeriod(from, to) {
  try {
    const r = await api('/api/planning/me/period', { method: 'PUT', body: JSON.stringify({ from, to, type: null }) });
    r.days.forEach(d => { if (de.days[d] === 'vacances') delete de.days[d]; });
    closeModal('daySheet');
    renderDesiderata();
  } catch (err) {
    const e = document.getElementById('daySheetError');
    e.textContent = err.message;
    e.classList.remove('hidden');
  }
}

function openVacationModal() {
  const first = `${de.months[0]}-01`;
  const lastMonth = de.months[de.months.length - 1];
  const last = `${lastMonth}-${pad(daysIn(lastMonth))}`;
  ['vacFrom', 'vacTo'].forEach(id => {
    const el = document.getElementById(id);
    el.min = first; el.max = last; el.value = '';
  });
  document.getElementById('vacError').classList.add('hidden');
  document.getElementById('vacationModal').classList.remove('hidden');
}

async function saveVacation(e) {
  e.preventDefault();
  const from = document.getElementById('vacFrom').value;
  const to = document.getElementById('vacTo').value;
  const err = document.getElementById('vacError');
  try {
    const r = await api('/api/planning/me/period', { method: 'PUT', body: JSON.stringify({ from, to, type: 'vacances' }) });
    r.days.forEach(d => { de.days[d] = 'vacances'; });
    closeModal('vacationModal');
    deSelectMonth(from.slice(0, 7));
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
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
  const onLeave = Array(data.days + 1).fill(0);
  const dayCols = Array.from({ length: data.days }, (_, i) => i + 1);
  const we = d => [0, 6].includes(weekdayOf(`${plMonth}-${pad(d)}`));

  const rows = data.users.map(u => {
    const days = byUser[u.id] || {};
    const cells = dayCols.map(d => {
      const t = days[d];
      if (isOffType(data.types, t)) totals[d]++;
      if (t === 'vacances') onLeave[d]++;
      return `<td class="${we(d) ? 'weekend' : ''} ${t ? 'off-' + t : ''}">${t ? data.types[t].code : ''}</td>`;
    }).join('');
    return `<tr><th scope="row">${esc(u.nom)} ${esc(u.prenom)}</th>${cells}<td class="pl-total">${Object.values(days).filter(t => isOffType(data.types, t)).length || ''}</td></tr>`;
  }).join('');

  wrap.innerHTML = data.users.length === 0 ? '<div class="empty-state">Aucun agent validé pour le moment.</div>' : `
    <table class="pl-table">
      <thead><tr><th scope="col">Agent</th>${dayCols.map(d => `<th scope="col" class="${we(d) ? 'weekend' : ''}"><span>${'DLMMJVS'[weekdayOf(`${plMonth}-${pad(d)}`)]}</span>${d}</th>`).join('')}<th scope="col">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th scope="row">Agents en OFF</th>${dayCols.map(d => `<td class="${we(d) ? 'weekend' : ''}">${totals[d] || ''}</td>`).join('')}<td></td></tr>
        <tr><th scope="row">Agents en vacances</th>${dayCols.map(d => `<td class="${we(d) ? 'weekend' : ''}">${onLeave[d] || ''}</td>`).join('')}<td></td></tr>
      </tfoot>
    </table>
    <p class="pl-note">${Object.values(data.types).map(t => `${t.code} = ${esc(t.label)}`).join(' · ')}. Les vacances (V) sont une information : elles sont posées sur Gestime et ne comptent pas dans le total des OFF.</p>`;

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

// Dates butoir en cours d'édition (enregistrées avec les autres règles)
let plDeadlines = {};

function renderDeadlines() {
  const list = document.getElementById('dlList');
  const months = Object.keys(plDeadlines).sort();
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  list.innerHTML = months.map(m => `<li><span><strong>${monthLabel(m)}</strong> : jusqu'au ${longDate(plDeadlines[m])}${plDeadlines[m] < today ? ' <em class="dl-closed">fermé</em>' : ''}</span>
    <button type="button" class="icon-btn" onclick="removeDeadline('${m}')" aria-label="Retirer la date butoir de ${monthLabel(m)}"><i class="ph ph-x"></i></button></li>`).join('');
  // Mois proposés : du mois en cours au dernier mois ouvert
  const current = today.slice(0, 7);
  const last = Math.min(24, Math.max(0, Number(document.getElementById('setOpenTo').value) || 0));
  const select = document.getElementById('dlMonth');
  const keep = select.value;
  select.innerHTML = Array.from({ length: last + 1 }, (_, i) => shiftMonth(current, i))
    .map(m => `<option value="${m}">${monthLabel(m)}${plDeadlines[m] ? ' · réglé' : ''}</option>`).join('');
  if ([...select.options].some(o => o.value === keep)) select.value = keep;
}

function addDeadline() {
  const m = document.getElementById('dlMonth').value;
  const d = document.getElementById('dlDate').value;
  const err = document.getElementById('plSettingsError');
  if (!m || !d) { err.textContent = 'Choisissez un mois et une date butoir.'; err.classList.remove('hidden'); return; }
  if (d > `${m}-${pad(daysIn(m))}`) { err.textContent = `La date butoir de ${monthLabel(m).toLowerCase()} doit tomber avant la fin de ce mois.`; err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  plDeadlines[m] = d;
  document.getElementById('dlDate').value = '';
  renderDeadlines();
}

function removeDeadline(m) { delete plDeadlines[m]; renderDeadlines(); }

async function loadPlanningSettings() {
  const { settings } = await api('/api/planning/settings');
  plDeadlines = { ...(settings.deadlines || {}) };
  document.getElementById('setOpenFrom').value = settings.open_from;
  document.getElementById('setOpenTo').value = settings.open_to;
  document.getElementById('setMaxMonth').value = settings.max_per_month;
  document.getElementById('setMaxRun').value = settings.max_consecutive;
  document.querySelectorAll('input[name="setTypes"]').forEach(c => { c.checked = settings.types.includes(c.value); });
  renderDeadlines();
  document.getElementById('setOpenTo').oninput = renderDeadlines;
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
      deadlines: plDeadlines,
    }) });
    ok.classList.remove('hidden');
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}
