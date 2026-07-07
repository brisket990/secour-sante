const express = require('express');
require('express-async-errors');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { initialize, get, all, run, reseed } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const tokens = new Set();

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Mot de passe incorrect' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  tokens.add(token);
  res.json({ token });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) tokens.delete(token);
  res.json({ success: true });
});

app.get('/api/hospitals', async (req, res) => {
  let { search } = req.query;
  let hospitals;
  if (search) {
    hospitals = await all(
      `SELECT DISTINCT h.* FROM hospitals h
       LEFT JOIN services s ON s.hospital_id = h.id
       WHERE h.name LIKE ? OR h.address LIKE ? OR s.name LIKE ? OR s.description LIKE ?
       ORDER BY h.name`,
      [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    if (hospitals.length === 0) {
      const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const q = norm(search);
      const allH = await all(`SELECT DISTINCT h.id, h.name, h.address, h.phone, h.lat, h.lng, GROUP_CONCAT(s.name, '||') AS svc_names, GROUP_CONCAT(s.description, '||') AS svc_descs FROM hospitals h LEFT JOIN services s ON s.hospital_id = h.id GROUP BY h.id ORDER BY h.name`);
      hospitals = allH.filter(h =>
        norm(h.name).includes(q) || norm(h.address || '').includes(q) ||
        norm(h.phone || '').includes(q) ||
        norm(h.svc_names || '').includes(q) || norm(h.svc_descs || '').includes(q)
      );
      hospitals = hospitals.map(({ svc_names, svc_descs, ...rest }) => rest);
    }
  } else {
    hospitals = await all('SELECT * FROM hospitals ORDER BY name');
  }
  res.json(hospitals);
});

app.get('/api/hospitals/:id', async (req, res) => {
  const hospital = await get('SELECT * FROM hospitals WHERE id = ?', [req.params.id]);
  if (!hospital) return res.status(404).json({ error: 'Hôpital non trouvé' });
  hospital.services = await all('SELECT * FROM services WHERE hospital_id = ? ORDER by name', [req.params.id]);
  res.json(hospital);
});

app.post('/api/hospitals', requireAuth, async (req, res) => {
  const { name, address, phone, lat, lng } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Nom et adresse requis' });
  const result = await run(
    'INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)',
    [name, address, phone || '', lat || 0, lng || 0]
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/hospitals/:id', requireAuth, async (req, res) => {
  const { name, address, phone, lat, lng } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Nom et adresse requis' });
  await run(
    'UPDATE hospitals SET name=?, address=?, phone=?, lat=?, lng=? WHERE id=?',
    [name, address, phone || '', lat || 0, lng || 0, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/hospitals/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM services WHERE hospital_id = ?', [req.params.id]);
  await run('DELETE FROM hospitals WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/services', requireAuth, async (req, res) => {
  const { hospital_id, name, floor, building, door_codes, description, phone } = req.body;
  if (!hospital_id || !name) return res.status(400).json({ error: 'ID hôpital et nom requis' });
  const result = await run(
    'INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hospital_id, name, floor || '', building || '', door_codes || '', description || '', phone || '']
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  const { name, floor, building, door_codes, description, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  await run(
    'UPDATE services SET name=?, floor=?, building=?, door_codes=?, description=?, phone=? WHERE id=?',
    [name, floor || '', building || '', door_codes || '', description || '', phone || '', req.params.id]
  );
  res.json({ success: true });
});

app.get('/api/protocols', async (req, res) => {
  res.json(await all('SELECT * FROM protocols ORDER BY sort_order, name'));
});

app.post('/api/protocols', requireAuth, async (req, res) => {
  const { name, icon, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Nom et URL requis' });
  const result = await run(
    'INSERT INTO protocols (name, icon, url) VALUES (?, ?, ?)',
    [name, icon || '', url]
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/protocols/:id', requireAuth, async (req, res) => {
  const { name, icon, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Nom et URL requis' });
  await run('UPDATE protocols SET name=?, icon=?, url=? WHERE id=?',
    [name, icon || '', url, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/protocols/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM protocols WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Nom, email et message requis' });
  const result = await run(
    'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
    [name, email, subject || '', message]
  );
  if (transporter) {
    transporter.sendMail({
      from: `"Formulaire RéaDirect" <${process.env.SMTP_USER || 'noreply@readirect.app'}>`,
      to: MAIL_TO,
      subject: `[RéaDirect] ${subject || 'Nouveau message de ' + name}`,
      text: `De: ${name} (${email})\nSujet: ${subject}\n\n${message}`,
    }).catch(() => {});
  }
  res.status(201).json({ id: result.lastInsertRowid, message: 'Message envoyé' });
});

app.get('/api/messages', requireAuth, async (req, res) => {
  res.json(await all('SELECT * FROM messages ORDER BY created_at DESC'));
});

app.put('/api/messages/:id/read', requireAuth, async (req, res) => {
  await run('UPDATE messages SET read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM messages WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/reseed', requireAuth, async (req, res) => {
  await reseed();
  res.json({ success: true, message: 'Données réinitialisées' });
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`RéaDirect démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur d\'initialisation:', err);
  process.exit(1);
});
