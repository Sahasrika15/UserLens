// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const currentProfileEl = document.getElementById('currentProfile');
  const openSetupBtn = document.getElementById('openSetup');
  const toggleApplyBtn = document.getElementById('toggleApply');

  function getActiveModeName() {
    let activeMode = '';
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['aura_special_modes'], (res) => {
        if (res && res.aura_special_modes) {
          const modes = res.aura_special_modes;
          if (modes.eyeComfortModeEnabled) {
            activeMode = ' (Eye Comfort Mode)';
          } else if (modes.autoNightModeEnabled) {
            const hour = new Date().getHours();
            const isNightTime = hour >= 20 || hour < 6;
            activeMode = isNightTime ? ' (Night Mode Active)' : ' (Night Mode - Inactive)';
          }
          updateDisplayWithMode(activeMode);
        }
      });
    } else {
      const modesRaw = localStorage.getItem('aura_special_modes');
      if (modesRaw) {
        const modes = JSON.parse(modesRaw);
        if (modes.eyeComfortModeEnabled) {
          activeMode = ' (Eye Comfort Mode)';
        } else if (modes.autoNightModeEnabled) {
          const hour = new Date().getHours();
          const isNightTime = hour >= 20 || hour < 6;
          activeMode = isNightTime ? ' (Night Mode Active)' : ' (Night Mode - Inactive)';
        }
      }
      updateDisplayWithMode(activeMode);
    }
  }

  function updateDisplayWithMode(modeText) {
    const profileName = currentProfileEl.textContent.replace(/ \(.*\)/, '');
    currentProfileEl.textContent = profileName + modeText;
  }

  function loadProfile() {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['aura_profile', 'aura_enabled'], (res) => {
        if (res && res.aura_profile) {
          const p = res.aura_profile;
          currentProfileEl.textContent = `Profile: ${p.name || 'Custom'}`;
        } else {
          currentProfileEl.textContent = 'No profile set';
        }
        toggleApplyBtn.checked = res.aura_enabled !== false;
        getActiveModeName(); // Update with active mode
      });
    } else {
      const p = JSON.parse(localStorage.getItem('aura_profile') || 'null');
      currentProfileEl.textContent = p ? `Profile: ${p.name || 'Custom'}` : 'No profile set';
      toggleApplyBtn.checked = localStorage.getItem('aura_enabled') !== 'false';
      getActiveModeName(); // Update with active mode
    }
  }

  function sendMessageToActiveTab(message) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        const tabId = tabs[0].id;
        if (typeof tabId === 'undefined') return;
        chrome.tabs.sendMessage(tabId, message, (resp) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn('AURA popup: sendMessageToActiveTab error', err.message);
          } else {
            console.log('AURA popup: sent message', message, 'resp:', resp);
          }
        });
      });
    } catch (e) {
      console.warn('AURA popup: sendMessageToActiveTab exception', e);
    }
  }

  toggleApplyBtn.addEventListener('change', () => {
    const enabled = toggleApplyBtn.checked;
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ aura_enabled: enabled }, () => {
        console.log('AURA popup: aura_enabled set to', enabled);
      });
    } else {
      localStorage.setItem('aura_enabled', enabled ? 'true' : 'false');
      console.log('AURA popup: aura_enabled (local) set to', enabled);
    }
  });

  openSetupBtn.addEventListener('click', () => {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
    } catch (e) {
      window.open('setup.html', '_blank');
    }

    sendMessageToActiveTab({ type: 'AURA_TOGGLE_PANEL' });
  });

  loadProfile();

  // Update mode status every minute
  setInterval(() => {
    getActiveModeName();
  }, 60000);
});