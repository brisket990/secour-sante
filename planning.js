// Desiderata de planning : chaque agent coche les jours OFF qu'il souhaite
// (jour, nuit ou les deux) pour les mois ouverts. L'admin règle les limites,
// la personne qui fait le planning consulte et exporte le mois en Excel ou PDF.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const TYPES = {
  jour: { label: 'Jour', code: 'J', fill: 'FFF4D6' },
  nuit: { label: 'Nuit', code: 'N', fill: 'DCE6FA' },
  both: { label: 'Jour et nuit', code: 'JN', fill: 'F2DCE6' },
};
const MENUS = ['hospitals', 'recherche', 'checklist', 'grandegarde', 'desiderata', 'contact'];
// Par défaut : saisie possible du mois +2 jusqu'à deux ans après le mois en cours
const DEFAULT_SETTINGS = { open_from: 2, open_to: 24, max_per_month: 6, max_consecutive: 3, types: ['jour', 'nuit', 'both'] };
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEKDAYS_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ===== Dates (chaînes YYYY-MM-DD, calculs en UTC pour éviter les décalages) =====
function todayParis() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function shiftDay(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(ym, d) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_FR[m - 1]} ${y}`;
}
function openMonths(s) {
  const current = todayParis().slice(0, 7);
  const out = [];
  for (let i = s.open_from; i <= s.open_to; i++) out.push(addMonths(current, i));
  return out;
}

// ===== Réglages =====
function validateSettings(input) {
  const int = v => (Number.isInteger(Number(v)) && String(v).trim() !== '' ? Number(v) : NaN);
  const s = {
    open_from: int(input.open_from),
    open_to: int(input.open_to),
    max_per_month: int(input.max_per_month),
    max_consecutive: int(input.max_consecutive),
    types: Array.isArray(input.types) ? input.types.filter(t => TYPES[t]) : [],
  };
  if (!(s.open_from >= 0 && s.open_from <= 24)) return { error: 'Premier mois ouvert : entre 0 et 24 mois à l\'avance' };
  if (!(s.open_to >= s.open_from && s.open_to <= 24)) return { error: 'Dernier mois ouvert : après le premier et au plus 24 mois à l\'avance' };
  if (!(s.max_per_month >= 1 && s.max_per_month <= 31)) return { error: 'Jours OFF par mois : entre 1 et 31' };
  if (!(s.max_consecutive >= 1 && s.max_consecutive <= 31)) return { error: 'Jours OFF à la suite : entre 1 et 31' };
  if (!s.types.length) return { error: 'Choisissez au moins un type de jour OFF' };
  return { settings: s };
}

// Ce que l'ajout de `day` donnerait avec les jours déjà posés (`days` : jour -> type)
function checkRules(s, days, day) {
  const month = day.slice(0, 7);
  const inMonth = Object.keys(days).filter(d => d.startsWith(month) && d !== day).length + 1;
  if (inMonth > s.max_per_month) return `Pas plus de ${s.max_per_month} jours OFF dans le mois.`;
  let run = 1;
  for (let d = shiftDay(day, -1); days[d]; d = shiftDay(d, -1)) run++;
  for (let d = shiftDay(day, 1); days[d]; d = shiftDay(d, 1)) run++;
  if (run > s.max_consecutive) return `Pas plus de ${s.max_consecutive} jours OFF à la suite.`;
  return null;
}

function hiddenMenus(user) {
  return String(user?.hidden_menus || '').split(',').filter(Boolean);
}

// ===== Exports =====
async function buildXlsx(ym, { users, entries }) {
  const n = daysInMonth(ym);
  const byUser = {};
  for (const e of entries) (byUser[e.user_id] ||= {})[Number(e.day.slice(8))] = e.type;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SMUR Beaujon';
  const ws = wb.addWorksheet(monthLabel(ym), {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  });
  ws.getCell('A1').value = `Desiderata OFF - ${monthLabel(ym)}`;
  ws.getCell('A1').font = { bold: true, size: 14 };

  const header = ws.getRow(3);
  header.values = ['Agent', 'APH', ...Array.from({ length: n }, (_, i) => `${WEEKDAYS_FR[weekday(ym, i + 1)]} ${i + 1}`), 'Total'];
  header.font = { bold: true };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  header.height = 30;
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 11;
  for (let d = 1; d <= n; d++) ws.getColumn(d + 2).width = 4.6;
  ws.getColumn(n + 3).width = 7;

  const weekend = d => [0, 6].includes(weekday(ym, d));
  const totals = Array(n + 1).fill(0);
  users.forEach((u, i) => {
    const days = byUser[u.id] || {};
    const row = ws.getRow(4 + i);
    const count = Object.keys(days).length;
    row.values = [`${u.nom} ${u.prenom}`, u.aph || '', ...Array.from({ length: n }, (_, k) => (days[k + 1] ? TYPES[days[k + 1]].code : '')), count || ''];
    for (let d = 1; d <= n; d++) {
      const cell = row.getCell(d + 2);
      cell.alignment = { horizontal: 'center' };
      const t = days[d];
      if (t) { totals[d]++; cell.font = { bold: true }; }
      const fill = t ? TYPES[t].fill : weekend(d) ? 'EEF1F5' : null;
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } };
    }
    row.getCell(n + 3).alignment = { horizontal: 'center' };
  });
  const totalRow = ws.getRow(4 + users.length);
  totalRow.values = ['Agents en OFF', '', ...totals.slice(1).map(v => v || '')];
  totalRow.font = { bold: true };
  for (let d = 1; d <= n; d++) totalRow.getCell(d + 2).alignment = { horizontal: 'center' };

  const thin = { style: 'thin', color: { argb: 'FFC9D1DC' } };
  for (let r = 3; r <= 4 + users.length; r++) {
    for (let c = 1; c <= n + 3; c++) ws.getRow(r).getCell(c).border = { top: thin, left: thin, bottom: thin, right: thin };
  }
  const legend = ws.getRow(6 + users.length);
  legend.values = ['Légende', Object.values(TYPES).map(t => `${t.code} = ${t.label}`).join('    ')];
  legend.getCell(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
}

function buildPdf(ym, { users, entries }) {
  return new Promise((resolve, reject) => {
    const n = daysInMonth(ym);
    const byUser = {};
    for (const e of entries) (byUser[e.user_id] ||= {})[Number(e.day.slice(8))] = e.type;

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24, info: { Title: `Desiderata ${monthLabel(ym)}` } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 24, nameW = 150, totalW = 30;
    const dayW = (doc.page.width - 48 - nameW - totalW) / n;
    const rowH = 16, headH = 24;
    const weekend = d => [0, 6].includes(weekday(ym, d));
    let y = 24;

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f1a2e').text(`Desiderata OFF - ${monthLabel(ym)}`, left, y);
    doc.font('Helvetica').fontSize(8).fillColor('#556377')
      .text(`SMUR Beaujon. Édité le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`, left, y + 18);
    y += 40;

    const cell = (x, yy, w, h, text, { fill, bold, color = '#0f1a2e', align = 'center', size = 7 } = {}) => {
      if (fill) doc.rect(x, yy, w, h).fill(fill);
      doc.rect(x, yy, w, h).lineWidth(0.4).strokeColor('#c9d1dc').stroke();
      if (text !== '' && text != null) {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
          .text(String(text), x + 2, yy + (h - size) / 2, { width: w - 4, align, lineBreak: false, ellipsis: true });
      }
    };
    const drawHeader = () => {
      cell(left, y, nameW, headH, 'Agent', { bold: true, align: 'left', fill: '#eef1f5' });
      for (let d = 1; d <= n; d++) {
        const x = left + nameW + (d - 1) * dayW;
        doc.rect(x, y, dayW, headH).fill(weekend(d) ? '#e3e7ee' : '#eef1f5');
        doc.rect(x, y, dayW, headH).lineWidth(0.4).strokeColor('#c9d1dc').stroke();
        doc.font('Helvetica').fontSize(6).fillColor('#556377').text(WEEKDAYS_FR[weekday(ym, d)], x, y + 4, { width: dayW, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f1a2e').text(String(d), x, y + 13, { width: dayW, align: 'center' });
      }
      cell(left + nameW + n * dayW, y, totalW, headH, 'Total', { bold: true, fill: '#eef1f5' });
      y += headH;
    };
    const ensureRoom = () => {
      if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 24; drawHeader(); }
    };

    drawHeader();
    const totals = Array(n + 1).fill(0);
    for (const u of users) {
      ensureRoom();
      const days = byUser[u.id] || {};
      cell(left, y, nameW, rowH, `${u.nom} ${u.prenom}${u.aph ? ` (${u.aph})` : ''}`, { align: 'left' });
      for (let d = 1; d <= n; d++) {
        const t = days[d];
        if (t) totals[d]++;
        cell(left + nameW + (d - 1) * dayW, y, dayW, rowH, t ? TYPES[t].code : '', { bold: true, fill: t ? '#' + TYPES[t].fill : weekend(d) ? '#f3f5f8' : null });
      }
      cell(left + nameW + n * dayW, y, totalW, rowH, Object.keys(days).length || '', { bold: true });
      y += rowH;
    }
    ensureRoom();
    cell(left, y, nameW, rowH, 'Agents en OFF', { bold: true, align: 'left', fill: '#eef1f5' });
    for (let d = 1; d <= n; d++) cell(left + nameW + (d - 1) * dayW, y, dayW, rowH, totals[d] || '', { bold: true, fill: '#eef1f5' });
    cell(left + nameW + n * dayW, y, totalW, rowH, '', { fill: '#eef1f5' });
    y += rowH + 12;

    doc.font('Helvetica').fontSize(8).fillColor('#556377')
      .text(Object.values(TYPES).map(t => `${t.code} = ${t.label}`).join('     '), left, y);
    doc.end();
  });
}

// ===== Routes =====
function registerPlanningRoutes(app, { get, all, run, requireAuth, signToken, verifyToken }) {
  async function getSettings() {
    const row = await get("SELECT value FROM settings WHERE key = 'planning'");
    if (!row) return { ...DEFAULT_SETTINGS };
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) }; } catch { return { ...DEFAULT_SETTINGS }; }
  }

  async function currentUser(req) {
    if (!req.auth?.email) return null;
    return get('SELECT id, nom, prenom, aph, role, hidden_menus, planner FROM users WHERE email = ?', [req.auth.email]);
  }

  // Admin ou utilisateur coché « fait le planning » (rôle relu en base)
  async function requirePlanner(req, res, next) {
    const user = await currentUser(req);
    if (user && (user.role === 'admin' || Number(user.planner) === 1)) return next();
    res.status(403).json({ error: 'Réservé à la personne qui fait le planning' });
  }

  async function monthData(ym) {
    const users = await all("SELECT id, nom, prenom, aph FROM users WHERE status = 'approved' ORDER BY nom, prenom");
    const entries = await all('SELECT user_id, day, type FROM desiderata WHERE day LIKE ?', [ym + '-%']);
    return { users, entries };
  }

  // Téléchargements : ouverts dans le navigateur (lien externe), donc authentifiés
  // par un jeton court passé dans l'URL plutôt que par l'en-tête Authorization.
  app.get('/export/planning/:file', async (req, res) => {
    const m = /^(\d{4}-\d{2})\.(xlsx|pdf)$/.exec(req.params.file);
    const t = verifyToken(String(req.query.token || ''), 'planning-export');
    if (!t) return res.status(401).send('Lien expiré, relancez le téléchargement depuis l\'application.');
    if (!m || !MONTH_RE.test(m[1]) || t.month !== m[1]) return res.status(400).send('Mois invalide');
    const [, ym, fmt] = m;
    const data = await monthData(ym);
    const name = `desiderata-${ym}.${fmt}`;
    if (fmt === 'xlsx') {
      const buf = await buildXlsx(ym, data);
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment(name).send(Buffer.from(buf));
    } else {
      const buf = await buildPdf(ym, data);
      res.type('application/pdf').attachment(name).send(buf);
    }
  });

  // Réglages lisibles par tous (pour afficher les règles), modifiables par l'admin
  app.get('/api/planning/settings', async (req, res) => {
    res.json({ settings: await getSettings(), types: TYPES, openMonths: openMonths(await getSettings()) });
  });

  app.put('/api/planning/settings', requireAuth, async (req, res) => {
    const { settings, error } = validateSettings(req.body || {});
    if (error) return res.status(400).json({ error });
    await run("INSERT INTO settings (key, value) VALUES ('planning', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(settings)]);
    res.json({ success: true, settings });
  });

  // Desiderata de l'agent connecté
  app.get('/api/planning/me', async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(404).json({ error: 'Aucun profil pour ce compte' });
    const settings = await getSettings();
    const months = openMonths(settings);
    const from = addMonths(months[0], -1) + '-01';
    const rows = await all('SELECT day, type FROM desiderata WHERE user_id = ? AND day >= ? ORDER BY day', [user.id, from]);
    res.json({ settings, types: TYPES, months, days: Object.fromEntries(rows.map(r => [r.day, r.type])) });
  });

  app.put('/api/planning/me/:day', async (req, res) => {
    const user = await currentUser(req);
    if (!user) return res.status(404).json({ error: 'Aucun profil pour ce compte' });
    if (hiddenMenus(user).includes('desiderata')) return res.status(403).json({ error: 'Desiderata non disponibles pour ce compte' });
    const day = req.params.day;
    if (!DAY_RE.test(day) || Number(day.slice(8)) > daysInMonth(day.slice(0, 7))) return res.status(400).json({ error: 'Date invalide' });
    const settings = await getSettings();
    if (!openMonths(settings).includes(day.slice(0, 7))) return res.status(400).json({ error: 'Ce mois n\'est pas ouvert à la saisie' });

    const type = req.body?.type || null;
    if (!type) {
      await run('DELETE FROM desiderata WHERE user_id = ? AND day = ?', [user.id, day]);
      return res.json({ success: true, day, type: null });
    }
    if (!settings.types.includes(type)) return res.status(400).json({ error: 'Type de jour OFF non autorisé' });
    const rows = await all('SELECT day, type FROM desiderata WHERE user_id = ? AND day >= ? AND day <= ?', [user.id, shiftDay(day, -40), shiftDay(day, 40)]);
    const error = checkRules(settings, Object.fromEntries(rows.map(r => [r.day, r.type])), day);
    if (error) return res.status(400).json({ error });
    await run('INSERT INTO desiderata (user_id, day, type) VALUES (?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET type = excluded.type', [user.id, day, type]);
    res.json({ success: true, day, type });
  });

  // Vue planning (admin et planificateur)
  app.get('/api/planning/month/:month', requirePlanner, async (req, res) => {
    if (!MONTH_RE.test(req.params.month)) return res.status(400).json({ error: 'Mois invalide' });
    res.json({ month: req.params.month, label: monthLabel(req.params.month), days: daysInMonth(req.params.month), types: TYPES, ...(await monthData(req.params.month)) });
  });

  app.post('/api/planning/export-token', requirePlanner, async (req, res) => {
    const month = String(req.body?.month || '');
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'Mois invalide' });
    res.json({ token: signToken({ scope: 'planning-export', month }, '5m') });
  });

  // Accès par utilisateur : menus masqués et droit « fait le planning »
  app.put('/api/users/:id/access', requireAuth, async (req, res) => {
    const hidden = (Array.isArray(req.body?.hidden_menus) ? req.body.hidden_menus : []).filter(m => MENUS.includes(m));
    await run('UPDATE users SET hidden_menus = ?, planner = ? WHERE id = ?', [hidden.join(','), req.body?.planner ? 1 : 0, req.params.id]);
    res.json({ success: true });
  });
}

module.exports = { registerPlanningRoutes, MENUS, TYPES, DEFAULT_SETTINGS, checkRules, validateSettings, openMonths, buildXlsx, buildPdf };
