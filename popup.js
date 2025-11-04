const currentProfileEl = document.getElementById('currentProfile');
const openSetupBtn = document.getElementById('openSetup');
const toggleApplyBtn = document.getElementById('toggleApply');

function loadProfile(){
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['aura_profile'], (res) => {
      if (res && res.aura_profile) {
        const p = res.aura_profile;
        currentProfileEl.textContent = `Profile: ${p.name || 'Custom'}`;
      } else {
        currentProfileEl.textContent = 'No profile set';
      }
    });
  } else {
    const p = JSON.parse(localStorage.getItem('aura_profile') || 'null');
    currentProfileEl.textContent = p ? `Profile: ${p.name || 'Custom'}` : 'No profile set';
  }
}

openSetupBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
});

toggleApplyBtn.addEventListener('click', () => {
  // If you want a simple toggle - we can set a flag in storage
  chrome.storage.sync.get(['aura_enabled'], (res) => {
    const enabled = !(res && res.aura_enabled);
    chrome.storage.sync.set({ aura_enabled: enabled }, () => {
      toggleApplyBtn.textContent = enabled ? 'Disable' : 'Enable';
    });
  });
});

loadProfile();
