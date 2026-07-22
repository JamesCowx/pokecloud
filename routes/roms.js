const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const ROMS_DIR = path.join(__dirname, '..', 'Roms');

const romExtensions = ['.gba', '.gb', '.gbc', '.nds', '.sfc', '.smc'];

let romCache = null;
let romCacheTime = 0;
const CACHE_TTL = 30000;

function scanRoms() {
  const now = Date.now();
  if (romCache && (now - romCacheTime) < CACHE_TTL) {
    return romCache;
  }

  const roms = [];
  if (!fs.existsSync(ROMS_DIR)) {
    romCache = roms;
    romCacheTime = now;
    return roms;
  }

  const files = fs.readdirSync(ROMS_DIR);
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

  romCache = roms;
  romCacheTime = now;
  return roms;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Public count endpoint
router.get('/count', (req, res) => {
  const roms = scanRoms();
  res.json({ count: roms.length });
});

// List ROMs (authenticated)
router.get('/', requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const roms = scanRoms();
  res.json(roms);
});

// Serve ROM file
router.get('/:id', requireAuth, (req, res) => {
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

module.exports = router;
