const express = require('express');
const path = require('path');
const crypto = require('crypto');
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
  hospital.services = all('SELECT * FROM services WHERE hospital_id = ? ORDER BY name', [req.params.id]);
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
  const { hospital_id, name, floor, description, phone } = req.body;
  if (!hospital_id || !name) return res.status(400).json({ error: 'ID hôpital et nom requis' });
  const result = run(
    'INSERT INTO services (hospital_id, name, floor, description, phone) VALUES (?, ?, ?, ?, ?)',
    [hospital_id, name, floor || '', description || '', phone || '']
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/services/:id', requireAuth, (req, res) => {
  const { name, floor, description, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  run(
    'UPDATE services SET name=?, floor=?, description=?, phone=? WHERE id=?',
    [name, floor || '', description || '', phone || '', req.params.id]
  );
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  run('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`SecourSanté démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur d\'initialisation:', err);
  process.exit(1);
});
