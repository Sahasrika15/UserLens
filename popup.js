const currentProfileEl = document.getElementById('currentProfile');
const openSetupBtn = document.getElementById('openSetup');
const toggleApplyBtn = document.getElementById('toggleApply');

function updateToggleButtonText(enabled) {
  toggleApplyBtn.textContent = enabled ? 'Disable' : 'Enable';
}

function loadProfile(){
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['aura_profile', 'aura_enabled'], (res) => {
      // 1. Load Profile Name
      if (res && res.aura_profile) {
        const p = res.aura_profile;
        currentProfileEl.textContent = `Profile: ${p.name || 'Custom'}`;
      } else {
        currentProfileEl.textContent = 'No profile set';
      }
      
      // 2. Load Enable/Disable State and Update Button
      // Default to true if not set (as per the content.js logic)
      const enabled = typeof res.aura_enabled !== 'undefined' ? res.aura_enabled : true; 
      updateToggleButtonText(enabled);
    });
  } else {
    // Local storage fallback (less robust, but maintaining original logic)
    const p = JSON.parse(localStorage.getItem('aura_profile') || 'null');
    currentProfileEl.textContent = p ? `Profile: ${p.name || 'Custom'}` : 'No profile set';
    // Cannot reliably get aura_enabled from localStorage in this snippet, 
    // so we'll default to the 'Enable' text for consistency when storage fails.
    updateToggleButtonText(false); 
  }
}

openSetupBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
});

toggleApplyBtn.addEventListener('click', () => {
  // If you want a simple toggle - we can set a flag in storage
  chrome.storage.sync.get(['aura_enabled'], (res) => {
    // Invert the current state (default to true if undefined)
    const enabled = !(res && typeof res.aura_enabled !== 'undefined' ? res.aura_enabled : true); 
    chrome.storage.sync.set({ aura_enabled: enabled }, () => {
      // Update button text immediately after setting the state
      updateToggleButtonText(enabled);
    });
  });
});

loadProfile();