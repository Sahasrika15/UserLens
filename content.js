function applyProfileToDocument(profile) {
  if (!profile) return;

  // Prevent double injection
  const existing = document.getElementById('aura-style-override');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'aura-style-override';

  // Check if animations should be disabled
  const disableAnimations = profile.animations === false;

  const css = `
    :root {
      --aura-bg: ${profile.bgColor};
      --aura-text: ${profile.textColor};
      --aura-font: ${profile.fontFamily};
      --aura-size: ${profile.fontSize}px;
      --aura-line: ${profile.lineHeight};
      --aura-letter: ${(profile.letterSpacing || 0)}px;
      --aura-word: ${(profile.wordSpacing || 0)}px;
    }
    html, body {
      background-color: var(--aura-bg) !important;
      color: var(--aura-text) !important;
      font-family: var(--aura-font) !important;
      font-size: var(--aura-size) !important;
      line-height: var(--aura-line) !important;
      letter-spacing: var(--aura-letter) !important;
      word-spacing: var(--aura-word) !important;
      ${disableAnimations ? 'animation: none !important; transition: none !important;' : ''}
    }
    p, li, span, a, h1, h2, h3, h4, h5, h6 {
      color: var(--aura-text) !important;
      font-family: var(--aura-font) !important;
      letter-spacing: var(--aura-letter) !important;
      word-spacing: var(--aura-word) !important;
      ${disableAnimations ? 'animation: none !important; transition: none !important;' : ''}
    }
    img, video { 
      outline: none !important;
      ${disableAnimations ? 'animation: none !important;' : ''}
    }
    ${disableAnimations ? `* { animation: none !important; transition: none !important; }` : ''}
  `;

  style.appendChild(document.createTextNode(css));
  document.documentElement.prepend(style);
}

// Get the saved profile and apply
function init() {
  function doApply(profile) {
    chrome.storage.sync.get(['aura_enabled'], (res) => {
      const enabled = res && typeof res.aura_enabled !== 'undefined' ? res.aura_enabled : true;
      if (enabled) applyProfileToDocument(profile);
    });
  }

  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['aura_profile'], (res) => {
      if (res && res.aura_profile) {
        doApply(res.aura_profile);
      }
    });

    // Listen for changes to apply dynamically
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.aura_profile) {
        doApply(changes.aura_profile.newValue);
      }
      if (area === 'sync' && changes.aura_enabled) {
        if (!changes.aura_enabled.newValue) {
          const existing = document.getElementById('aura-style-override');
          if (existing) existing.remove();
        } else {
          chrome.storage.sync.get(['aura_profile'], (res) => {
            if (res && res.aura_profile) applyProfileToDocument(res.aura_profile);
          });
        }
      }
    });
  } else {
    // Fallback for testing
    const raw = localStorage.getItem('aura_profile');
    if (raw) applyProfileToDocument(JSON.parse(raw));
  }
}

init();