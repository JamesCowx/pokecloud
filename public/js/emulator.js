// ============================================
// PokeCloud Emulator - JavaScript
// ============================================

let currentRomId = null;
let currentSaveId = null;
let romName = '';
let romPlatform = '';

document.addEventListener('DOMContentLoaded', () => {
  initEmulatorPage();
  setupSaveLoad();
  setupFullscreen();
  setupVolumeControls();
  setupKeyboardShortcuts();
});

// ============================================
// Initialize Emulator Page
// ============================================
async function initEmulatorPage() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) {
      window.location.href = '/login';
      return;
    }
  } catch {
    window.location.href = '/login';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  currentRomId = params.get('rom');
  currentSaveId = params.get('save');

  if (!currentRomId) {
    window.location.href = '/dashboard';
    return;
  }

  await loadRomInfo();
  await startEmulator();
}

// ============================================
// Load ROM Info
// ============================================
async function loadRomInfo() {
  try {
    const res = await fetch('/api/roms');
    if (!res.ok) throw new Error('Failed to load ROM info');

    const roms = await res.json();
    const rom = roms.find(r => r.id === currentRomId);

    if (rom) {
      romName = rom.name;
      romPlatform = rom.platform;
      document.getElementById('gameTitle').textContent = rom.name;
      document.getElementById('gamePlatform').textContent = rom.platform;
    }
  } catch (err) {
    console.error('Error loading ROM info:', err);
  }
}

// ============================================
// Determine EmulatorJS core from platform
// ============================================
function getCoreForPlatform(platform) {
  if (platform === 'Game Boy Advance') return 'gba';
  if (platform === 'Game Boy' || platform === 'Game Boy Color') return 'gb';
  if (platform === 'Nintendo DS') return 'nds';
  if (platform === 'Super Nintendo') return 'snes';
  return 'gba';
}

// ============================================
// Start Emulator
// ============================================
async function startEmulator() {
  const core = getCoreForPlatform(romPlatform);

  // If we have a save ID, load the save data first
  if (currentSaveId) {
    await loadSaveData(currentSaveId, core);
  }

  // Hook into EmulatorJS save events
  window.EJS_onSaveSave = async function(event) {
    console.log('EmulatorJS save event triggered');
    if (event && event.save) {
      try {
        const saveBlob = event.save;
        const reader = new FileReader();
        reader.onload = async function() {
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
          await uploadSaveToCloud(base64Data, null);
        };
        reader.readAsArrayBuffer(saveBlob);
      } catch (e) {
        console.error('Error capturing save:', e);
      }
    }
  };

  window.EJS_onSaveState = async function(event) {
    console.log('EmulatorJS save state event triggered');
    if (event && event.save) {
      try {
        const saveBlob = event.save;
        const reader = new FileReader();
        reader.onload = async function() {
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
          await uploadSaveToCloud(null, base64Data);
        };
        reader.readAsArrayBuffer(saveBlob);
      } catch (e) {
        console.error('Error capturing save state:', e);
      }
    }
  };

  // Set ALL EmulatorJS config BEFORE loading the script
  window.EJS_player = '#game';
  window.EJS_pathtodata = '/emulatorjs/EmulatorJS-main/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_Color = '#e3350d';
  window.EJS_core = core;
  window.EJS_gameUrl = `/api/rom/${currentRomId}`;
  window.EJS_volume = 1;

  // Inject the loader script
  const script = document.createElement('script');
  script.src = '/emulatorjs/EmulatorJS-main/data/loader.js';
  script.onerror = () => {
    showToast('Failed to load emulator files.', 'error');
  };
  document.body.appendChild(script);
}

// ============================================
// Upload Save to Cloud
// ============================================
async function uploadSaveToCloud(saveData, saveState) {
  try {
    const saveName = 'Cloud Save - ' + new Date().toLocaleString();
    const res = await fetch(`/api/saves/${currentRomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        save_name: saveName,
        save_data: saveData,
        save_state: saveState
      })
    });

    if (res.ok) {
      showToast('Saved to cloud!', 'success');
    } else {
      showToast('Cloud save failed', 'error');
    }
  } catch (err) {
    console.error('Cloud save error:', err);
    showToast('Cloud save failed', 'error');
  }
}

// ============================================
// Load Save Data from server
// ============================================
async function loadSaveData(saveId, core) {
  try {
    const res = await fetch(`/api/saves/${currentRomId}/${saveId}/download`);
    if (!res.ok) throw new Error('Failed to load save');

    const data = await res.json();
    console.log('Save data loaded from cloud');
    return data;
  } catch (err) {
    console.error('Error loading save data:', err);
    return null;
  }
}

// ============================================
// Save/Load UI Setup
// ============================================
function setupSaveLoad() {
  const saveBtn = document.getElementById('saveGameBtn');
  const loadBtn = document.getElementById('loadSaveBtn');
  const saveModal = document.getElementById('saveModal');
  const loadModal = document.getElementById('loadModal');
  const saveModalClose = document.getElementById('saveModalClose');
  const loadModalClose = document.getElementById('loadModalClose');
  const cancelSave = document.getElementById('cancelSave');
  const confirmSave = document.getElementById('confirmSave');

  saveBtn.addEventListener('click', () => {
    saveModal.style.display = 'flex';
  });

  saveModalClose.addEventListener('click', () => {
    saveModal.style.display = 'none';
  });

  cancelSave.addEventListener('click', () => {
    saveModal.style.display = 'none';
  });

  saveModal.addEventListener('click', (e) => {
    if (e.target === saveModal) saveModal.style.display = 'none';
  });

  confirmSave.addEventListener('click', async () => {
    await manualSave();
    saveModal.style.display = 'none';
  });

  loadBtn.addEventListener('click', async () => {
    loadModal.style.display = 'flex';
    await loadSavesList();
  });

  loadModalClose.addEventListener('click', () => {
    loadModal.style.display = 'none';
  });

  loadModal.addEventListener('click', (e) => {
    if (e.target === loadModal) loadModal.style.display = 'none';
  });
}

// ============================================
// Manual Save (triggered by Save button)
// ============================================
async function manualSave() {
  const saveName = document.getElementById('saveName').value || 'Manual Save';

  // Try to get save data from EmulatorJS
  let saveData = null;
  let saveState = null;

  try {
    if (window.EJS_emulator && window.EJS_emulator.gameManager) {
      const file = await window.EJS_emulator.gameManager.getSaveFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = async function() {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(reader.result)));
          await uploadManualSave(saveName, base64, null);
        };
        reader.readAsArrayBuffer(file);
        return;
      }
    }
  } catch (e) {
    console.log('Could not get save from emulator:', e);
  }

  // Fallback: try localStorage
  try {
    const core = window.EJS_core;
    const saveKey = `ejs-${core}-save`;
    const stateKey = `ejs-${core}-state`;
    saveData = localStorage.getItem(saveKey);
    saveState = localStorage.getItem(stateKey);

    if (saveData || saveState) {
      await uploadManualSave(saveName, saveData, saveState);
    } else {
      showToast('No save data found. Play the game first!', 'info');
    }
  } catch (e) {
    console.error('Manual save error:', e);
    showToast('Failed to save', 'error');
  }
}

async function uploadManualSave(saveName, saveData, saveState) {
  try {
    const res = await fetch(`/api/saves/${currentRomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        save_name: saveName,
        save_data: saveData,
        save_state: saveState
      })
    });

    if (res.ok) {
      showToast('Game saved to cloud!', 'success');
    } else {
      showToast('Failed to save game', 'error');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save game', 'error');
  }
}

// ============================================
// Load Saves List
// ============================================
async function loadSavesList() {
  const body = document.getElementById('loadModalBody');

  body.innerHTML = `
    <div class="loading-saves">
      <div class="pokeball-spinner"></div>
      <p>Loading saves...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/saves/${currentRomId}`);
    if (!res.ok) throw new Error('Failed to load saves');

    const saves = await res.json();

    if (saves.length === 0) {
      body.innerHTML = '<div class="no-saves-msg">No save files found. Save your game first!</div>';
      return;
    }

    body.innerHTML = saves.map(save => `
      <div class="save-load-item">
        <div class="save-load-info">
          <span class="save-load-name">${escHtml(save.save_name)}</span>
          <span class="save-load-date">${new Date(save.updated_at).toLocaleString()}</span>
        </div>
        <button class="save-load-btn" data-save-id="${save.id}">Load</button>
      </div>
    `).join('');

    body.querySelectorAll('.save-load-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const saveId = e.currentTarget.dataset.saveId;
        document.getElementById('loadModal').style.display = 'none';
        showToast('Save loaded! Restart the game to apply.', 'info');
      });
    });
  } catch (err) {
    console.error('Error loading saves:', err);
    body.innerHTML = '<div class="no-saves-msg">Failed to load saves.</div>';
  }
}

// ============================================
// Volume Controls
// ============================================
function setupVolumeControls() {
  const slider = document.getElementById('volumeSlider');
  const label = document.getElementById('volumeLabel');
  const muteBtn = document.getElementById('muteBtn');
  const volumeIcon = document.getElementById('volumeIcon');
  let isMuted = false;
  let lastVolume = 100;

  function updateIcon(vol) {
    if (vol === 0) {
      volumeIcon.innerHTML = '<path d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>';
    } else {
      volumeIcon.innerHTML = '<path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>';
    }
  }

  function applyVolume(vol) {
    vol = Math.max(0, Math.min(100, vol));
    slider.value = vol;
    label.textContent = vol;
    updateIcon(vol);

    try {
      if (window.EJS_emulator && typeof window.EJS_emulator.setVolume === 'function') {
        window.EJS_emulator.setVolume(vol / 100);
      }
    } catch (e) {}
  }

  slider.addEventListener('input', () => {
    isMuted = false;
    applyVolume(parseInt(slider.value));
  });

  muteBtn.addEventListener('click', () => {
    if (isMuted) {
      isMuted = false;
      applyVolume(lastVolume);
    } else {
      isMuted = true;
      lastVolume = parseInt(slider.value);
      applyVolume(0);
    }
  });

  let volumeInitAttempts = 0;
  const initInterval = setInterval(() => {
    volumeInitAttempts++;
    if (window.EJS_emulator && typeof window.EJS_emulator.setVolume === 'function') {
      clearInterval(initInterval);
      applyVolume(parseInt(slider.value));
    }
    if (volumeInitAttempts > 60) clearInterval(initInterval);
  }, 500);
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'F5') {
      e.preventDefault();
      document.getElementById('saveModal').style.display = 'flex';
    } else if (e.key === 'F9') {
      e.preventDefault();
      document.getElementById('loadModal').style.display = 'flex';
      loadSavesList();
    } else if (e.key === 'F11') {
      e.preventDefault();
      const gameEl = document.getElementById('game');
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (gameEl) {
        gameEl.requestFullscreen().catch(() => {});
      }
    } else if (e.key === 'Escape') {
      document.getElementById('saveModal').style.display = 'none';
      document.getElementById('loadModal').style.display = 'none';
    }
  });
}

// ============================================
// Setup Fullscreen
// ============================================
function setupFullscreen() {
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  fullscreenBtn.addEventListener('click', () => {
    const gameEl = document.getElementById('game');

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (gameEl) {
      gameEl.requestFullscreen().catch(err => {
        console.error('Fullscreen error:', err);
      });
    }
  });
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type}`;
  toast.querySelector('.toast-message').textContent = message;
  toast.style.display = 'flex';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
