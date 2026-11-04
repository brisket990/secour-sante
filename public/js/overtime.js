// Dépassement horaire : formulaire Google du SMUR, pré-rempli. L'agent indique sa
// fin de service réelle, l'appli calcule le dépassement. SMUR, nom et date sont
// remplis d'office. Pour mettre à jour le formulaire : changer OT_FORM (entry.*).
(function () {
const OT_FORM = {
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSdFpDhYfpKH8M6eyrxG4fkocrLbeNnq0eEZyerYN5hGTGwoGA/viewform?usp=pp_url',
  smur: 950103303, nom: 2000042623, date: 1608348259, amplitude: 524591933,
  fin: 486833707, depassement: 1692170853, motif: 410629918,
};
// `value` : libellé exact de l'option dans le formulaire Google
const SHIFTS = [
  { label: '7h - 19h', value: '07H 19H', start: '07:00', end: '19:00' },
  { label: '8h - 18h', value: '08H 18H', start: '08:00', end: '18:00' },
];
const SMUR_CODE = 'BJN';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const shift = () => SHIFTS.find(s => s.value === document.querySelector('input[name="otShift"]:checked')?.value) || SHIFTS[0];

// Minutes de dépassement. Une fin avant le début du service est prise pour une
// fin après minuit (service 7h-19h fini à 1h : 6h) ; une fin pendant le service
// ne donne aucun dépassement.
function overtimeMinutes(s, real) {
  const r = minutes(real), end = minutes(s.end);
  if (r > end) return r - end;
  if (r < minutes(s.start)) return r + 1440 - end;
  return 0;
}
const formatDuration = m => `${Math.floor(m / 60)}h${pad(m % 60)}`; // 90 -> 1h30
const formatClock = hhmm => { const [h, m] = hhmm.split(':'); return `${Number(h)}h${m === '00' ? '' : m}`; }; // 19:30 -> 19h30, 18:00 -> 18h

function update() {
  const s = shift();
  const real = $('otEnd').value;
  const date = $('otDate').value;
  const motif = $('otMotif').value;
  const other = $('otOther').value.trim();
  const nom = userInfo?.nom || '';
  $('otOtherField').classList.toggle('hidden', motif !== '__other_option__');
  $('otEndHelp').textContent = `Fin prévue : ${formatClock(s.end)}`;

  const over = real ? overtimeMinutes(s, real) : 0;
  const result = $('otResult');
  result.classList.toggle('none', !over);
  result.innerHTML = over
    ? `<span>Dépassement calculé</span><strong>${formatDuration(over)}</strong>`
    : `<span>${real ? `Pas de dépassement : fin réelle avant ou à ${formatClock(s.end)}` : 'Saisissez la fin réelle pour calculer le dépassement'}</span>`;

  const missing = [];
  if (!nom) missing.push('nom du compte');
  if (!date) missing.push('date');
  if (!over) missing.push('heure de fin après la fin prévue');
  if (motif === '__other_option__' && !other) missing.push('motif');

  const go = $('otGo'), msg = $('otMsg');
  if (missing.length) {
    go.setAttribute('aria-disabled', 'true');
    go.href = '#';
    msg.className = 'miss';
    msg.textContent = 'À remplir : ' + missing.join(', ');
    return;
  }
  const params = [
    [OT_FORM.smur, SMUR_CODE], [OT_FORM.nom, nom], [OT_FORM.date, date], [OT_FORM.amplitude, s.value],
    [OT_FORM.fin, formatClock(real)], [OT_FORM.depassement, formatDuration(over)], [OT_FORM.motif, motif],
  ].map(([id, v]) => `entry.${id}=${encodeURIComponent(v)}`);
  if (motif === '__other_option__') params.push(`entry.${OT_FORM.motif}.other_option_response=${encodeURIComponent(other)}`);
  go.removeAttribute('aria-disabled');
  go.href = OT_FORM.url + '&' + params.join('&');
  // Fin après minuit ou très long dépassement : souvent une faute de frappe
  const afterMidnight = minutes(real) < minutes(s.start);
  msg.className = afterMidnight || over > 360 ? 'miss' : '';
  msg.textContent = afterMidnight
    ? `Fin après minuit : ${formatDuration(over)}. Vérifiez l'heure et la date.`
    : over > 360
      ? `${formatDuration(over)} de dépassement : vérifiez l'heure saisie.`
      : `${formatDuration(over)} de dépassement. Vérifiez puis touchez Envoyer dans le formulaire.`;
}

// À chaque ouverture : date du jour, 7h-19h, motif PRIMAIRE, fin réelle à saisir
window.loadOvertime = function () {
  const now = new Date();
  $('otDate').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  $('otName').textContent = userInfo ? `${userInfo.nom} ${userInfo.prenom}` : '';
  $('otShift').innerHTML = SHIFTS.map((s, i) =>
    `<label><input type="radio" name="otShift" value="${s.value}"${i === 0 ? ' checked' : ''}><span>${s.label}</span></label>`).join('');
  $('otEnd').value = '';
  $('otMotif').value = 'PRIMAIRE';
  $('otOther').value = '';
  update();
};

const view = $('view-overtime');
view.addEventListener('input', update);
view.addEventListener('change', update);
$('otGo').addEventListener('click', e => {
  e.preventDefault();
  if ($('otGo').getAttribute('aria-disabled') !== 'true') openExternal($('otGo').href);
});
})();
