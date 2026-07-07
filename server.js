const express = require('express');
require('express-async-errors');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { initialize, get, all, run, reseed } = require('./database');

BigInt.prototype.toJSON = function() { return Number(this); };

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'readirect-secret-change-in-prod';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const decoded = verifyToken(req.headers.authorization?.replace('Bearer ', ''));
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  req.auth = decoded;
  next();
}

function requireAnyAuth(req, res, next) {
  const decoded = verifyToken(req.headers.authorization?.replace('Bearer ', ''));
  if (!decoded) return res.status(401).json({ error: 'Connectez-vous' });
  req.auth = decoded;
  next();
}

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 1000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPw(pw, stored) {
  const [salt, key] = stored.split(':');
  return crypto.pbkdf2Sync(pw, salt, 1000, 64, 'sha512').toString('hex') === key;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = signToken({ role: 'admin' });
    return res.json({ token, role: 'admin' });
  }
  const user = await get('SELECT * FROM users WHERE email = ?', [req.body.email]);
  if (!user) return res.status(403).json({ error: 'Email ou mot de passe incorrect' });
  if (user.status !== 'approved') return res.status(403).json({ error: 'Compte en attente de validation' });
  if (!verifyPw(req.body.password, user.password)) return res.status(403).json({ error: 'Email ou mot de passe incorrect' });
  const token = signToken({ nom: user.nom, prenom: user.prenom, email: user.email, smur: user.smur, role: user.role });
  res.json({ token, role: user.role, user: { nom: user.nom, prenom: user.prenom, email: user.email, smur: user.smur } });
});

app.post('/api/register', async (req, res) => {
  const { nom, prenom, email, smur, password } = req.body;
  if (!nom || !prenom || !email || !smur || !password) return res.status(400).json({ error: 'Tous les champs sont requis' });
  if (!email.endsWith('@aphp.fr') && !email.endsWith('@ghu-paris.fr')) return res.status(400).json({ error: 'Email @aphp.fr requis' });
  const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Cet email est déjà enregistré' });
  const hashed = hashPw(password);
  const result = await run('INSERT INTO users (nom, prenom, email, smur, password) VALUES (?, ?, ?, ?, ?)',
    [nom, prenom, email, smur, hashed]);
  res.status(201).json({ message: 'Compte créé, en attente de validation par un administrateur' });
});

app.get('/api/pending-users', requireAuth, async (req, res) => {
  res.json(await all("SELECT id, nom, prenom, email, smur, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC"));
});

app.get('/api/users', requireAuth, async (req, res) => {
  res.json(await all("SELECT id, nom, prenom, email, smur, role, status, created_at FROM users ORDER BY created_at DESC"));
});

app.put('/api/users/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  await run('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true });
});

app.put('/api/users/:id/role', requireAuth, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  await run("UPDATE users SET role = ?, status = 'approved' WHERE id = ?", [role, req.params.id]);
  res.json({ success: true, message: 'L\'utilisateur doit se reconnecter pour que le changement prenne effet' });
});

app.put('/api/users/:id/approve', requireAuth, async (req, res) => {
  await run('UPDATE users SET status = ? WHERE id = ?', ['approved', req.params.id]);
  res.json({ success: true });
});

app.put('/api/users/:id/promote', requireAuth, async (req, res) => {
  await run("UPDATE users SET role = 'admin', status = 'approved' WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: 'L\'utilisateur doit se reconnecter pour que le changement prenne effet' });
});

app.delete('/api/users/:id/reject', requireAuth, async (req, res) => {
  await run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  await run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const decoded = verifyToken(req.headers.authorization?.replace('Bearer ', ''));
  if (!decoded) return res.json({ authed: false });
  if (decoded.role === 'admin') return res.json({ authed: true, role: 'admin' });
  res.json({ authed: true, role: decoded.role, user: decoded });
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true });
});

// Protect all /api/ routes below (user must be logged in)
app.use('/api', requireAnyAuth);

app.get('/api/hospitals', requireAnyAuth, async (req, res) => {
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

app.get('/api/hospitals/:id', requireAnyAuth, async (req, res) => {
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

// Global error handler (returns JSON)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

console.log('DB mode:', process.env.TURSO_DATABASE_URL ? 'Turso' : 'Local sql.js');

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`RéaDirect démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur d\'initialisation:', err);
  process.exit(1);
});
