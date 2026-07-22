const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Get saves for a ROM
router.get('/:romId', requireAuth, (req, res) => {
  try {
    const { romId } = req.params;
    const db = getDb();
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
router.get('/:romId/:saveId/download', requireAuth, (req, res) => {
  try {
    const { romId, saveId } = req.params;
    const db = getDb();
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
router.post('/:romId', requireAuth, (req, res) => {
  try {
    const { romId } = req.params;
    const { save_name, save_data, save_state } = req.body;
    const db = getDb();

    if (!save_name) {
      return res.status(400).json({ error: 'Save name is required' });
    }

    const existing = db.exec(
      'SELECT id FROM saves WHERE user_id = ? AND rom_id = ? AND save_name = ?',
      [req.session.userId, romId, save_name]
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      const saveId = existing[0].values[0][0];
      db.run(
        'UPDATE saves SET save_data = ?, save_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [save_data || null, save_state || null, saveId]
      );
      saveDatabase();
      res.json({ success: true, id: saveId, updated: true });
    } else {
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
router.delete('/:romId/:saveId', requireAuth, (req, res) => {
  try {
    const { romId, saveId } = req.params;
    const db = getDb();
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

module.exports = router;
