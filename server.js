const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, '..', 'Database', 'pokecloud.db');
const ROMS_DIR = path.join(__dirname, '..', 'Roms');
const SAVES_DIR = path.join(__dirname, '..', 'VirtualConsole', 'saves');
const SESSIONS_DIR = path.join(__dirname, 'sessions');

let db;

// Ensure directories exist
[path.dirname(DB_PATH), ROMS_DIR, SAVES_DIR, SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 7 * 24 * 60 * 60,
    retries: 0,
    logFn: function() {}
  }),
  secret: 'pokecloud-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Scan ROMs directory for available games
function scanRoms() {
  const romExtensions = ['.gba', '.gb', '.gbc', '.nds', '.sfc', '.smc'];
  const roms = [];

  if (!fs.existsSync(ROMS_DIR)) return roms;

  const files = fs.readdirSync(ROMS_DIR);
  console.log('Found', files.length, 'files in Roms directory');
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (romExtensions.includes(ext)) {
      const name = path.basename(file, ext)
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/  +/g, ' ')
        .trim();

      let platform = 'Unknown';
      if (ext === '.gba') platform = 'Game Boy Advance';
      else if (ext === '.gb') platform = 'Game Boy';
      else if (ext === '.gbc') platform = 'Game Boy Color';
      else if (ext === '.nds') platform = 'Nintendo DS';
      else if (ext === '.sfc' || ext === '.smc') platform = 'Super Nintendo';

      console.log('Adding ROM:', name);
      roms.push({
        id: Buffer.from(file).toString('base64'),
        filename: file,
        name: name,
        platform: platform,
        extension: ext,
        size: fs.statSync(path.join(ROMS_DIR, file)).size
      });
    }
  });

  console.log('Returning', roms.length, 'ROMs');
  return roms;
}

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();

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

  // Persist database to disk
  saveDatabase();
  console.log('Database initialized');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// API Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

    // Check if user exists
    const existing = db.exec('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.run('INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
      [userId, username, email, hashedPassword]);
    saveDatabase();

    req.session.userId = userId;
    req.session.username = username;

    res.json({ success: true, user: { id: userId, username } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = db.exec('SELECT id, username, password FROM users WHERE username = ?', [username]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const [id, uname, hashedPassword] = result[0].values[0];
    const valid = await bcrypt.compare(password, hashedPassword);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.userId = id;
    req.session.username = uname;

    res.json({ success: true, user: { id, username: uname } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
  res.json({ id: req.session.userId, username: req.session.username });
});

// List ROMs
app.get('/api/roms', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const roms = scanRoms();
  console.log('API /api/roms called by user:', req.session.username, '- returning', roms.length, 'ROMs');
  res.json(roms);
});

// Serve ROM file
app.get('/api/rom/:id', requireAuth, (req, res) => {
  try {
    const filename = Buffer.from(req.params.id, 'base64').toString();
    const filepath = path.join(ROMS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'ROM not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filepath);
  } catch (err) {
    console.error('ROM serve error:', err);
    res.status(500).json({ error: 'Failed to serve ROM' });
  }
});

// Get saves for a ROM
app.get('/api/saves/:romId', requireAuth, (req, res) => {
  try {
    const { romId } = req.params;
    const result = db.exec(
      'SELECT id, save_name, created_at, updated_at FROM saves WHERE user_id = ? AND rom_id = ?',
      [req.session.userId, romId]
    );

    const saves = result.length > 0
      ? result[0].values.map(([id, save_name, created_at, updated_at]) => ({
          id, save_name, created_at, updated_at
        }))
      : [];

    res.json(saves);
  } catch (err) {
    console.error('Get saves error:', err);
    res.status(500).json({ error: 'Failed to get saves' });
  }
});

// Download save data
app.get('/api/saves/:romId/:saveId/download', requireAuth, (req, res) => {
  try {
    const { romId, saveId } = req.params;
    const result = db.exec(
      'SELECT save_data, save_state FROM saves WHERE id = ? AND user_id = ? AND rom_id = ?',
      [saveId, req.session.userId, romId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Save not found' });
    }

    const [saveData, saveState] = result[0].values[0];
    res.json({ save_data: saveData, save_state: saveState });
  } catch (err) {
    console.error('Download save error:', err);
    res.status(500).json({ error: 'Failed to download save' });
  }
});

// Upload/Update save data
app.post('/api/saves/:romId', requireAuth, (req, res) => {
  try {
    const { romId } = req.params;
    const { save_name, save_data, save_state } = req.body;

    if (!save_name) {
      return res.status(400).json({ error: 'Save name is required' });
    }

    // Check if save exists
    const existing = db.exec(
      'SELECT id FROM saves WHERE user_id = ? AND rom_id = ? AND save_name = ?',
      [req.session.userId, romId, save_name]
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      // Update existing save
      const saveId = existing[0].values[0][0];
      db.run(
        'UPDATE saves SET save_data = ?, save_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [save_data || null, save_state || null, saveId]
      );
      saveDatabase();
      res.json({ success: true, id: saveId, updated: true });
    } else {
      // Create new save
      const saveId = uuidv4();
      db.run(
        'INSERT INTO saves (id, user_id, rom_id, save_name, save_data, save_state) VALUES (?, ?, ?, ?, ?, ?)',
        [saveId, req.session.userId, romId, save_name, save_data || null, save_state || null]
      );
      saveDatabase();
      res.json({ success: true, id: saveId, updated: false });
    }
  } catch (err) {
    console.error('Save upload error:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Delete save
app.delete('/api/saves/:romId/:saveId', requireAuth, (req, res) => {
  try {
    const { romId, saveId } = req.params;
    db.run(
      'DELETE FROM saves WHERE id = ? AND user_id = ? AND rom_id = ?',
      [saveId, req.session.userId, romId]
    );
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete save error:', err);
    res.status(500).json({ error: 'Failed to delete save' });
  }
});

// Page routes (redirect to proper pages)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

// Start server
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`PokeCloud server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
