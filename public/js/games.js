let currentUser = null;
let currentRomId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  setupLogout();
  setupModal();
});

async function initDashboard() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) {
      window.location.href = '/login';
      return;
    }
    currentUser = await res.json();
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('welcomeName').textContent = currentUser.username;
    document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
    loadRoms();
  } catch (err) {
    window.location.href = '/login';
  }
}

async function loadRoms() {
  try {
    const res = await fetch('/api/roms?t=' + Date.now());
    if (!res.ok) throw new Error('Failed to load ROMs');
    const roms = await res.json();
    document.getElementById('totalRoms').textContent = roms.length;
    const grid = document.getElementById('gamesGrid');
    if (roms.length === 0) {
      grid.innerHTML = '';
      document.getElementById('emptyState').style.display = 'flex';
      return;
    }
    document.getElementById('emptyState').style.display = 'none';
    let totalSaves = 0;
    const cards = [];
    for (const rom of roms) {
      const saves = await loadSavesForRom(rom.id);
      totalSaves += saves.length;
      cards.push(buildCard(rom, saves));
    }
    document.getElementById('totalSaves').textContent = totalSaves;
    grid.innerHTML = cards.join('');
    setupGameCards();
  } catch (err) {
    console.error('Error loading ROMs:', err);
  }
}

async function loadSavesForRom(romId) {
  try {
    const res = await fetch('/api/saves/' + romId);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function buildCard(rom, saves) {
  const platformBadge = 'GBA';
  const hasSaves = Array.isArray(saves) && saves.length > 0;
  const lastSave = hasSaves ? new Date(saves[0].updated_at).toLocaleDateString() : null;

  const images = {
    'Pokemon - FireRed Version': '/assets/FireRedSplash2.jpg',
    'Pokemon - LeafGreen Version': '/assets/LeafGreenSplash.jpg'
  };

  let img = null;
  for (const key in images) {
    if (rom.name.includes(key)) {
      img = images[key];
      break;
    }
  }

  const artStyle = img ? ' style="background-image:url(' + img + ');background-size:cover;background-position:center;"' : '';
  const iconHtml = img ? '' : '<div class="game-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c-1.103-.178-2.13.658-2.13 1.772v0c0 .852.57 1.595 1.397 1.852a6.714 6.714 0 003.551.147c.344-.07.657.138.772.47.13.372.283.737.46 1.093.18.36.164.784-.044 1.14-.303.527-.76.94-1.28 1.217-.52.278-1.1.412-1.72.412h-1.5c-.62 0-1.2-.134-1.72-.412a3.068 3.068 0 01-1.28-1.217c-.208-.356-.224-.78-.044-1.14.177-.356.33-.72.46-1.093.115-.332.428-.54.772-.47a6.714 6.714 0 003.551-.147c.827-.257 1.397-1 1.397-1.852v0c0-1.114-1.027-1.95-2.13-1.772a48.491 48.491 0 01-4.163.3.64.64 0 01-.657-.643v0c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875S2.25 4.036 2.25 5.072c0 .369.128.713.349 1.003.215.283.401.604.401.959v0c0 .552.448 1 1 1h4.5c.552 0 1-.448 1-1v0z"/></svg></div>';

  let savesBtn = '';
  if (hasSaves) {
    savesBtn = '<button class="btn-saves" data-rom-id="' + rom.id + '" data-action="saves"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg> Saves</button>';
  }

  const saveText = hasSaves ? '<span>Last save: ' + lastSave + '</span>' : '<span>No saves</span>';
  const playText = hasSaves ? 'Continue' : 'Play';

  return '<div class="game-card" data-rom-id="' + rom.id + '">' +
    '<div class="game-card-art"' + artStyle + '>' + iconHtml + '</div>' +
    '<div class="game-card-info">' +
    '<div class="game-card-header"><h3>' + rom.name + '</h3><span class="game-platform-tag"><img src="/assets/GBA.jpg" alt="GBA" class="gba-icon-lg"> GBA</span></div>' +
    '<div class="game-card-meta"><span>' + rom.platform + '</span>' + saveText + '</div>' +
    '<div class="game-card-actions">' +
    '<button class="btn-play" data-rom-id="' + rom.id + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg> ' + playText + '</button>' +
    savesBtn +
    '</div></div></div>';
}

function setupGameCards() {
  document.querySelectorAll('.btn-play').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      playGame(e.currentTarget.dataset.romId);
    });
  });
  document.querySelectorAll('.btn-saves').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      openSavesModal(e.currentTarget.dataset.romId);
    });
  });
}

function playGame(romId, saveId) {
  var url = '/play?rom=' + romId;
  if (saveId) url += '&save=' + saveId;
  window.location.href = url;
}

function setupModal() {
  var modal = document.getElementById('savesModal');
  document.getElementById('modalClose').addEventListener('click', function() {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.style.display = 'none';
  });
  document.getElementById('modalNewGame').addEventListener('click', function() {
    if (currentRomId) playGame(currentRomId);
  });
}

async function openSavesModal(romId) {
  currentRomId = romId;
  var modal = document.getElementById('savesModal');
  var body = document.getElementById('modalBody');
  var card = document.querySelector('.game-card[data-rom-id="' + romId + '"]');
  document.getElementById('modalTitle').textContent = (card ? card.querySelector('h3').textContent : 'Game') + ' - Save Files';
  body.innerHTML = '<div class="loading-state"><div class="pokeball-spinner"></div></div>';
  modal.style.display = 'flex';
  try {
    var saves = await loadSavesForRom(romId);
    if (saves.length === 0) {
      body.innerHTML = '<div class="no-saves">No save files yet. Start a new game!</div>';
    } else {
      body.innerHTML = saves.map(function(save) {
        return '<div class="save-item"><div class="save-info"><span class="save-name">' + save.save_name + '</span><span class="save-date">Last updated: ' + new Date(save.updated_at).toLocaleString() + '</span></div><button class="save-load-btn" data-save-id="' + save.id + '" data-rom-id="' + romId + '">Load</button></div>';
      }).join('');
      body.querySelectorAll('.save-load-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          playGame(e.currentTarget.dataset.romId, e.currentTarget.dataset.saveId);
        });
      });
    }
  } catch (err) {
    body.innerHTML = '<div class="no-saves">Failed to load saves.</div>';
  }
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async function() {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}
