const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'Database', 'pokecloud.db');

let db;

function getDb() {
  return db;
}

async function initDatabase() {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      rom_id TEXT NOT NULL,
      save_name TEXT NOT NULL,
      save_data BLOB,
      save_state BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, rom_id, save_name)
    )
  `);

  saveDatabase();

  const adminCheck = db.exec('SELECT id FROM users WHERE username = ?', ['Admin']);
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hashedPassword = await bcrypt.hash('Admin', 10);
    const adminId = uuidv4();
    db.run('INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
      [adminId, 'Admin', 'admin@pokecloud.local', hashedPassword]);
    saveDatabase();
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

module.exports = { getDb, initDatabase, saveDatabase };
