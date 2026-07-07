const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { initialize, get, all, run } = require('./database');

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

app.get('/api/hospitals', (req, res) => {
  const { search } = req.query;
  let hospitals;
  if (search) {
    hospitals = all(
      `SELECT DISTINCT h.* FROM hospitals h
       LEFT JOIN services s ON s.hospital_id = h.id
       WHERE h.name LIKE ? OR h.address LIKE ? OR s.name LIKE ? OR s.description LIKE ?
       ORDER BY h.name`,
      [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
  } else {
    hospitals = all('SELECT * FROM hospitals ORDER BY name');
  }
  res.json(hospitals);
});

app.get('/api/hospitals/:id', (req, res) => {
  const hospital = get('SELECT * FROM hospitals WHERE id = ?', [req.params.id]);
  if (!hospital) return res.status(404).json({ error: 'Hôpital non trouvé' });
  hospital.services = all('SELECT * FROM services WHERE hospital_id = ? ORDER by name', [req.params.id]);
  res.json(hospital);
});

app.post('/api/hospitals', requireAuth, (req, res) => {
  const { name, address, phone, lat, lng } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Nom et adresse requis' });
  const result = run(
    'INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)',
    [name, address, phone || '', lat || 0, lng || 0]
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/hospitals/:id', requireAuth, (req, res) => {
  const { name, address, phone, lat, lng } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'Nom et adresse requis' });
  run(
    'UPDATE hospitals SET name=?, address=?, phone=?, lat=?, lng=? WHERE id=?',
    [name, address, phone || '', lat || 0, lng || 0, req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/hospitals/:id', requireAuth, (req, res) => {
  run('DELETE FROM services WHERE hospital_id = ?', [req.params.id]);
  run('DELETE FROM hospitals WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/services', requireAuth, (req, res) => {
  const { hospital_id, name, floor, building, door_codes, description, phone } = req.body;
  if (!hospital_id || !name) return res.status(400).json({ error: 'ID hôpital et nom requis' });
  const result = run(
    'INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hospital_id, name, floor || '', building || '', door_codes || '', description || '', phone || '']
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/services/:id', requireAuth, (req, res) => {
  const { name, floor, building, door_codes, description, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  run(
    'UPDATE services SET name=?, floor=?, building=?, door_codes=?, description=?, phone=? WHERE id=?',
    [name, floor || '', building || '', door_codes || '', description || '', phone || '', req.params.id]
  );
  res.json({ success: true });
});

// Config email (optionnel)
const MAIL_TO = process.env.MAIL_TO || 'google.stamina231@passmail.com';
let transporter = null;
try {
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.log('Email configuré');
  } else {
    console.log('Email non configuré (les messages sont stockés en BDD)');
  }
} catch (e) {
  console.log('Email indisponible, stockage BDD uniquement');
}

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Nom, email et message requis' });
  const result = run(
    'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
    [name, email, subject || '', message]
  );
  if (transporter) {
    transporter.sendMail({
      from: `"Formulaire SecourSanté" <${process.env.SMTP_USER || 'noreply@secoursante.app'}>`,
      to: MAIL_TO,
      subject: `[SecourSanté] ${subject || 'Nouveau message de ' + name}`,
      text: `De: ${name} (${email})\nSujet: ${subject}\n\n${message}`,
    }).catch(() => {});
  }
  res.status(201).json({ id: result.lastInsertRowid, message: 'Message envoyé' });
});

app.get('/api/messages', requireAuth, (req, res) => {
  res.json(all('SELECT * FROM messages ORDER BY created_at DESC'));
});

app.put('/api/messages/:id/read', requireAuth, (req, res) => {
  run('UPDATE messages SET read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
  run('DELETE FROM messages WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  run('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`SecourSante démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur d\'initialisation:', err);
  process.exit(1);
});
