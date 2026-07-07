const fs = require('fs');
const path = require('path');

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

let db;
let query, get, all, run;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS hospitals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT DEFAULT '', lat REAL DEFAULT 0, lng REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT DEFAULT '', message TEXT NOT NULL, read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS protocols (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT DEFAULT '', url TEXT DEFAULT '', sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, hospital_id INTEGER NOT NULL, name TEXT NOT NULL, floor TEXT DEFAULT '', building TEXT DEFAULT '', door_codes TEXT DEFAULT '', description TEXT DEFAULT '', phone TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE)`,
];

async function createTables() {
  for (const sql of TABLES) {
    await db.execute(sql);
  }
}

async function seedData() {
  const count = await db.execute("SELECT COUNT(*) as c FROM hospitals");
  if (count.rows[0].c > 0) return;

  await db.execute("BEGIN TRANSACTION");
  try {
    // CHU Bordeaux
    let r = await db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772] });
    const h1 = r.lastInsertRowid;
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h1, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h1, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h1, "Bloc opératoire urgent", "1er étage", "Bâtiment Bloc", "Badge requis", "Chirurgie d'urgence", "05 56 79 55 20"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h1, "Déchocage", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Prise en charge des polytraumatisés", "05 56 79 55 05"] });

    // Pitié-Salpêtrière
    r = await db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640] });
    const h2 = r.lastInsertRowid;
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h2, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h2, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h2, "Neurovasculaire (UNV)", "4e étage", "Bâtiment Sud", "Code 2222", "Accident vasculaire cérébral", "01 42 16 02 20"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h2, "Brûlés", "5e étage", "Bâtiment Spécialisé", "Code 3333", "Centre de traitement des grands brûlés", "01 42 16 03 30"] });

    // Édouard Herriot
    r = await db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800] });
    const h3 = r.lastInsertRowid;
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h3, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h3, "Réanimation médicale", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Soins intensifs", "04 72 11 01 10"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h3, "Choc septique", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Prise en charge sepsis sévère", "04 72 11 01 15"] });

    // La Timone
    r = await db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000] });
    const h4 = r.lastInsertRowid;
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h4, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h4, "Réanimation polyvalente", "1er étage", "Bâtiment B", "Code 7777", "Réanimation adulte", "04 91 38 61 10"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h4, "Déchocage - Traumatologie", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Accueil polytraumatisé", "04 91 38 61 05"] });

    // Lille
    r = await db.execute({ sql: "INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)", args: ["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400] });
    const h5 = r.lastInsertRowid;
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h5, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h5, "Réanimation médicale", "2e étage", "Bâtiment C", "Code 9999", "Soins intensifs polyvalents", "03 20 44 50 10"] });
    await db.execute({ sql: "INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [h5, "Neurochirurgie urgente", "4e étage", "Bâtiment D", "Code 0000", "Bloc neurochirurgical d'urgence", "03 20 44 50 20"] });

    // Default protocols
    const pc = await db.execute("SELECT COUNT(*) as c FROM protocols");
    if (pc.rows[0].c === 0) {
      await db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0] });
      await db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1] });
      await db.execute({ sql: "INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)", args: ["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2] });
    }

    await db.execute("COMMIT");
  } catch (e) {
    await db.execute("ROLLBACK");
    throw e;
  }
}

async function initialize(forceLocal) {
  if (dbUrl && !forceLocal) {
    console.log('Connexion Turso...');
    const { createClient } = require('@libsql/client');
    try {
      db = createClient({ url: dbUrl, authToken: dbToken });
      // Test connection
      await db.execute("SELECT 1");
      console.log('Turso connecté');
    } catch (e) {
      console.error('Erreur connexion Turso:', e.message);
      console.log('Fallback vers sql.js local');
      return initialize(true);
    }

    query = async (sql, params = []) => {
      const result = await db.execute({ sql, args: params });
      if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
        return result.rows;
      }
      return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
    };
    get = async (sql, params = []) => { const rows = await query(sql, params); return rows[0] || null; };
    all = async (sql, params = []) => query(sql, params);
    run = async (sql, params = []) => {
      const result = await db.execute({ sql, args: params });
      return { lastInsertRowid: result.lastInsertRowid, changes: result.rowsAffected };
    };

    await createTables();
    await seedData();
  } else {
    const initSqlJs = require('sql.js');
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }

    function saveDb() {
      fs.writeFileSync(dbPath, Buffer.from(db.export()));
    }

    query = (sql, params = []) => {
      const stmt = db.prepare(sql);
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
      const lastId = db.exec("SELECT last_insert_rowid() as id");
      const changes = db.exec("SELECT changes() as c");
      saveDb();
      return { lastInsertRowid: lastId[0]?.values[0][0] || 0, changes: changes[0]?.values[0][0] || 0 };
    };
    get = (sql, params = []) => { const rows = query(sql, params); return rows[0] || null; };
    all = (sql, params = []) => query(sql, params);
    run = (sql, params = []) => query(sql, params);

    for (const sql of TABLES) { db.run(sql); }
    saveDb();

    const count = db.exec("SELECT COUNT(*) as c FROM hospitals");
    if (!count[0] || count[0].values[0][0] === 0) {
      const insertH = db.prepare("INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)");
      const insertS = db.prepare("INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)");

      db.run("BEGIN TRANSACTION");
      insertH.run(["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772]);
      const h1 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      insertS.run([h1, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"]);
      insertS.run([h1, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"]);
      insertS.run([h1, "Bloc opératoire urgent", "1er étage", "Bâtiment Bloc", "Badge requis", "Chirurgie d'urgence", "05 56 79 55 20"]);
      insertS.run([h1, "Déchocage", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Prise en charge des polytraumatisés", "05 56 79 55 05"]);

      insertH.run(["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640]);
      const h2 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      insertS.run([h2, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"]);
      insertS.run([h2, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"]);
      insertS.run([h2, "Neurovasculaire (UNV)", "4e étage", "Bâtiment Sud", "Code 2222", "Accident vasculaire cérébral", "01 42 16 02 20"]);
      insertS.run([h2, "Brûlés", "5e étage", "Bâtiment Spécialisé", "Code 3333", "Centre de traitement des grands brûlés", "01 42 16 03 30"]);

      insertH.run(["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800]);
      const h3 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      insertS.run([h3, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"]);
      insertS.run([h3, "Réanimation médicale", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Soins intensifs", "04 72 11 01 10"]);
      insertS.run([h3, "Choc septique", "3e étage - Pavillon G", "Pavillon G", "Code 5555", "Prise en charge sepsis sévère", "04 72 11 01 15"]);

      insertH.run(["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000]);
      const h4 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      insertS.run([h4, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"]);
      insertS.run([h4, "Réanimation polyvalente", "1er étage", "Bâtiment B", "Code 7777", "Réanimation adulte", "04 91 38 61 10"]);
      insertS.run([h4, "Déchocage - Traumatologie", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Accueil polytraumatisé", "04 91 38 61 05"]);

      insertH.run(["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400]);
      const h5 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      insertS.run([h5, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"]);
      insertS.run([h5, "Réanimation médicale", "2e étage", "Bâtiment C", "Code 9999", "Soins intensifs polyvalents", "03 20 44 50 10"]);
      insertS.run([h5, "Neurochirurgie urgente", "4e étage", "Bâtiment D", "Code 0000", "Bloc neurochirurgical d'urgence", "03 20 44 50 20"]);

      db.run("COMMIT");
      saveDb();
      insertH.free();
      insertS.free();

      const pCount = db.exec("SELECT COUNT(*) as c FROM protocols");
      if (!pCount[0] || pCount[0].values[0][0] === 0) {
        const insertP = db.prepare("INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)");
        insertP.run(["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0]);
        insertP.run(["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1]);
        insertP.run(["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2]);
        insertP.free();
        saveDb();
      }
    }
  }
}

async function reseed() {
  if (dbUrl) {
    await run('DELETE FROM services');
    await run('DELETE FROM hospitals');
    await run('DELETE FROM protocols');
    await seedData();
  } else {
    const insertH = db.prepare("INSERT INTO hospitals (name, address, phone, lat, lng) VALUES (?, ?, ?, ?, ?)");
    const insertS = db.prepare("INSERT INTO services (hospital_id, name, floor, building, door_codes, description, phone) VALUES (?, ?, ?, ?, ?, ?, ?)");
    db.run("BEGIN TRANSACTION");

    insertH.run(["CHU de Bordeaux - Pellegrin", "Place Amélie Raba Léon, 33000 Bordeaux", "05 56 79 56 79", 44.8300, -0.5772]);
    const h1 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([h1, "Urgences - SAMU", "Rez-de-chaussée", "Bâtiment Accueil", "Code 1234", "Accueil des urgences vitales", "15"]);
    insertS.run([h1, "Réanimation médicale", "3e étage", "Bâtiment G", "Code 5678", "Soins intensifs polyvalents", "05 56 79 55 10"]);

    insertH.run(["Hôpital de la Pitié-Salpêtrière", "47-83 Boulevard de l'Hôpital, 75013 Paris", "01 42 16 00 00", 48.8378, 2.3640]);
    const h2 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([h2, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 0000", "Régulation et intervention", "15"]);
    insertS.run([h2, "Réanimation chirurgicale", "2e étage", "Bâtiment Nord", "Code 1111", "Réanimation post-opératoire", "01 42 16 01 10"]);

    insertH.run(["Hôpital Édouard Herriot - Lyon", "5 Place d'Arsonval, 69003 Lyon", "04 72 11 00 00", 45.7455, 4.8800]);
    const h3 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([h3, "Urgences - SAMU 69", "Rez-de-chaussée - Pavillon N", "Pavillon N", "Code 4444", "Urgences adultes", "15"]);

    insertH.run(["AP-HM - Hôpital de la Timone", "264 Rue Saint-Pierre, 13005 Marseille", "04 91 38 60 00", 43.2900, 5.4000]);
    const h4 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([h4, "Urgences adultes", "Rez-de-chaussée", "Bâtiment A", "Code 6666", "Urgences médico-chirurgicales", "15"]);

    insertH.run(["CHU de Lille - Hôpital Roger Salengro", "Avenue du Professeur Émile Laine, 59037 Lille", "03 20 44 59 62", 50.6130, 3.0400]);
    const h5 = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    insertS.run([h5, "SAMU - SMUR", "Rez-de-chaussée", "Bâtiment Principal", "Code 8888", "Régulation médicale", "15"]);

    db.run("COMMIT");
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'hopitaux.db');
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
    insertH.free();
    insertS.free();

    run('DELETE FROM protocols');
    const insertP = db.prepare("INSERT INTO protocols (name, icon, url, sort_order) VALUES (?, ?, ?, ?)");
    insertP.run(["Neurochirurgicales", "🧠", "/pdf/neurochirurgicales.pdf", 0]);
    insertP.run(["Thrombectomie", "🩸", "/pdf/thrombectomie.pdf", 1]);
    insertP.run(["Hémorragies de la délivrance", "🆘", "/pdf/hemorragies-delivrance.pdf", 2]);
    insertP.free();
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  }
}

async function exec(sql, params = []) {
  return query(sql, params);
}

// In Turso mode, run is sometimes used as a direct alias
// For the reseed fallback we need the sync version

module.exports = { initialize, get, all, run, reseed, query, exec };