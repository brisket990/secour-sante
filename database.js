const fs = require('fs');
const path = require('path');

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

let _db;
let _mode = 'none'; // 'turso' | 'local'

const TABLES = [
  `CREATE TABLE IF NOT EXISTS hospitals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT DEFAULT '', lat REAL DEFAULT 0, lng REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT DEFAULT '', message TEXT NOT NULL, read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS protocols (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '', url TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, hospital_id INTEGER NOT NULL, name TEXT NOT NULL, floor TEXT DEFAULT '', building TEXT DEFAULT '', door_codes TEXT DEFAULT '', description TEXT DEFAULT '', phone TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE)`,
];

function query(sql, params = []) {
  if (_mode === 'turso') {
    return _queryTurso(sql, params);
  }
  return _queryLocal(sql, params);
}

function get(sql, params = []) {
  const rows = query(sql, params);
  if (_mode === 'turso') return rows.then(r => r[0] || null);
  return rows[0] || null;
}

function all(sql, params = []) {
  return query(sql, params);
}

function run(sql, params = []) {
  return query(sql, params);
}

// ===== TURSO IMPLEMENTATION =====
async function _queryTurso(sql, params = []) {
  const result = await _db.execute({ sql, args: params });
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
  if (isSelect) return result.rows;
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.rowsAffected };
}

async function _createTablesTurso() {
  for (const sql of TABLES) {
    await _db.execute(sql);
  }
}

async function _seedTurso() {
  const count = await _db.execute("SELECT COUNT(*) as c FROM hospitals");
  if (count.rows[0].c > 0) return;

  await _db.execute("BEGIN TRANSACTION");
  try {
    let r = await _db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772] });
    let hid = r.lastInsertRowid;
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Bloc opératoire urgent", "1er étage", "Bâtiment Bloc", "Badge requis", "Chirurgie d'urgence", "05 56 79 55 20"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Déchocage", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Prise en charge des polytraumatisés", "05 56 79 55 05"] });

    r = await _db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640] });
    hid = r.lastInsertRowid;
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Neurovasculaire (UNV)", "4e étage", "Bâtiment Sud", "Code 2222", "Accident vasculaire cérébral", "01 42 16 02 20"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Brûlés", "5e étage", "Bâtiment Spécialisé", "Code 3333", "Centre de traitement des grands brûlés", "01 42 16 03 30"] });

    r = await _db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800] });
    hid = r.lastInsertRowid;
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Réanimation médicale", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Soins intensifs", "04 72 11 01 10"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Choc septique", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Prise en charge sepsis sévère", "04 72 11 01 15"] });

    r = await _db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000] });
    hid = r.lastInsertRowid;
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Réanimation polyvalente", "1er étage", "Bâtiment B", "Code 7777", "Réanimation adulte", "04 91 38 61 10"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Déchocage - Traumatologie", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Accueil polytraumatisé", "04 91 38 61 05"] });

    r = await _db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400] });
    hid = r.lastInsertRowid;
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Réanimation médicale", "2e étage", "Bâtiment C", "Code 9999", "Soins intensifs polyvalents", "03 20 44 50 10"] });
    await _db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [hid, "Neurochirurgie urgente", "4e étage", "Bâtiment D", "Code 0000", "Bloc neurochirurgical d'urgence", "03 20 44 50 20"] });

    const pc = await _db.execute("SELECT COUNT(*) as c FROM protocols");
    if (pc.rows[0].c === 0) {
      await _db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0] });
      await _db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1] });
      await _db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2] });
    }

    await _db.execute("COMMIT");
  } catch (e) {
    await _db.execute("ROLLBACK");
    throw e;
  }
}

// ===== LOCAL SQL.JS IMPLEMENTATION =====
function _localSave() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
  fs.writeFileSync(dbPath, Buffer.from(_db.export()));
}

function _queryLocal(sql, params = []) {
  const stmt = _db.prepare(sql);
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH');
  if (isSelect) {
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  stmt.run(params);
  stmt.free();
  const lastId = _db.exec("SELECT last_insert_rowid() as id");
  const changes = _db.exec("SELECT changes() as c");
  _localSave();
  return { lastInsertRowid: lastId[0]?.values[0][0] || 0, changes: changes[0]?.values[0][0] || 0 };
}

function _localSeed() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
  const count = _db.exec("SELECT COUNT(*) as c FROM hospitals");
  if (count[0] && count[0].values[0][0] > 0) return;

  const insertH = _db.prepare("INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)");
  const insertS = _db.prepare("INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)");
  _db.run("BEGIN TRANSACTION");
  insertH.run(["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772]);
  let hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  insertS.run([hid, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"]);
  insertS.run([hid, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"]);
  insertS.run([hid, "Bloc opératoire urgent", "1er étage", "Bâtiment Bloc", "Badge requis", "Chirurgie d'urgence", "05 56 79 55 20"]);
  insertS.run([hid, "Déchocage", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Prise en charge des polytraumatisés", "05 56 79 55 05"]);

  insertH.run(["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640]);
  hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  insertS.run([hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"]);
  insertS.run([hid, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"]);
  insertS.run([hid, "Neurovasculaire (UNV)", "4e étage", "Bâtiment Sud", "Code 2222", "Accident vasculaire cérébral", "01 42 16 02 20"]);
  insertS.run([hid, "Brûlés", "5e étage", "Bâtiment Spécialisé", "Code 3333", "Centre de traitement des grands brûlés", "01 42 16 03 30"]);

  insertH.run(["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800]);
  hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  insertS.run([hid, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"]);
  insertS.run([hid, "Réanimation médicale", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Soins intensifs", "04 72 11 01 10"]);
  insertS.run([hid, "Choc septique", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Prise en charge sepsis sévère", "04 72 11 01 15"]);

  insertH.run(["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000]);
  hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  insertS.run([hid, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"]);
  insertS.run([hid, "Réanimation polyvalente", "1er étage", "Bâtiment B", "Code 7777", "Réanimation adulte", "04 91 38 61 10"]);
  insertS.run([hid, "Déchocage - Traumatologie", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Accueil polytraumatisé", "04 91 38 61 05"]);

  insertH.run(["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400]);
  hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
  insertS.run([hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"]);
  insertS.run([hid, "Réanimation médicale", "2e étage", "Bâtiment C", "Code 9999", "Soins intensifs polyvalents", "03 20 44 50 10"]);
  insertS.run([hid, "Neurochirurgie urgente", "4e étage", "Bâtiment D", "Code 0000", "Bloc neurochirurgical d'urgence", "03 20 44 50 20"]);

  _db.run("COMMIT");
  _localSave();
  insertH.free();
  insertS.free();

  const pCount = _db.exec("SELECT COUNT(*) as c FROM protocols");
  if (!pCount[0] || pCount[0].values[0][0] === 0) {
    const insertP = _db.prepare("INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)");
    insertP.run(["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0]);
    insertP.run(["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1]);
    insertP.run(["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2]);
    insertP.free();
    _localSave();
  }
}

// ===== INITIALIZE =====
async function initialize(forceLocal) {
  if (dbUrl && !forceLocal) {
    console.log('[DB] Mode Turso...');
    const { createClient } = require('@libsql/client');
    try {
      _db = createClient({ url: dbUrl, authToken: dbToken });
      await _db.execute("SELECT 1");
      _mode = 'turso';
      console.log('[DB] Turso connecté');
      await _createTablesTurso();
      await _seedTurso();
    } catch (e) {
      console.error('[DB] Erreur Turso:', e.message);
      console.log('[DB] Fallback local');
      return initialize(true);
    }
  } else {
    console.log('[DB] Mode local sql.js');
    const initSqlJs = require('sql.js');
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const SQL = await initSqlJs();
    _db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
    _mode = 'local';
    for (const sql of TABLES) { _db.run(sql); }
    _localSave();
    _localSeed();
  }
}

async function reseed() {
  if (_mode === 'turso') {
    await _db.execute("DELETE FROM services");
    await _db.execute("DELETE FROM hospitals");
    await _db.execute("DELETE FROM protocols");
    await _seedTurso();
  } else {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
    _db.run("DELETE FROM services");
    _db.run("DELETE FROM hospitals");
    const insertH = _db.prepare("INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)");
    const insertS = _db.prepare("INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)");
    _db.run("BEGIN TRANSACTION");
    insertH.run(["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772]);
    let hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([hid, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"]);
    insertS.run([hid, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"]);
    insertH.run(["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640]);
    hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"]);
    insertS.run([hid, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"]);
    insertH.run(["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800]);
    hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([hid, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"]);
    insertH.run(["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000]);
    hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([hid, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"]);
    insertH.run(["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400]);
    hid = _db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([hid, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"]);
    _db.run("COMMIT");
    fs.writeFileSync(dbPath, Buffer.from(_db.export()));
    insertH.free();
    insertS.free();
    _db.run("DELETE FROM protocols");
    const insertP = _db.prepare("INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)");
    insertP.run(["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0]);
    insertP.run(["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1]);
    insertP.run(["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2]);
    insertP.free();
    fs.writeFileSync(dbPath, Buffer.from(_db.export()));
  }
}

module.exports = { initialize, get, all, run, reseed };