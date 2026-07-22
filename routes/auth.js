const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const db = getDb();

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

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
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDb();

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
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// Get current user
router.get('/user', requireAuth, (req, res) => {
  res.json({ id: req.session.userId, username: req.session.username });
});

module.exports = router;
