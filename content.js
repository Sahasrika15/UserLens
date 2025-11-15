(() => {
  'use strict';

  const STYLE_ID = 'aura-style-override';
  const SHADOW_STYLE_ID = 'aura-shadow-override';
  const SIDEPANEL_HOST_ID = 'aura-sidepanel-host';
  const SIDEPANEL_BACKDROP_ID = 'aura-sidepanel-backdrop';

  let currentProfile = null;
  let isEnabled = true;
  let auraPanelHost = null;
  let auraPanelIframe = null;
  let autoNightModeEnabled = false;
  let eyeComfortModeEnabled = false;
  let nightModeProfile = { id: 'nightMode', name: 'Night Mode (Auto)', fontSize: 16, fontFamily: "'Roboto', sans-serif", bgColor: "#0a0a0a", textColor: "#e8e8e8", lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0, animations: false, cursorType: 'auto' };
  let eyeComfortProfile = { id: 'eyeComfort', name: 'Eye Comfort Mode', fontSize: 17, fontFamily: "'Verdana', sans-serif", bgColor: "#f5f1e8", textColor: "#2a2420", lineHeight: 1.7, letterSpacing: 0.05, wordSpacing: 0.1, animations: false, cursorType: 'auto' };

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }

  function isNightTimeNow() {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 6; // 8 PM (20:00) to 6 AM (06:00)
  }

  function getActiveProfile() {
    if (eyeComfortModeEnabled) {
      return eyeComfortProfile;
    }
    if (autoNightModeEnabled && isNightTimeNow()) {
      return nightModeProfile;
    }
    return currentProfile;
  }

  function buildCSS(profile) {
    if (!profile) return '';
    try {
      const disableAnim = profile.animations === false;
      const cursor = profile.cursorType || 'auto';

      return `
:root {
  --aura-bg: ${profile.bgColor};
  --aura-text: ${profile.textColor};
  --aura-font: ${profile.fontFamily};
  --aura-size: ${profile.fontSize}px;
  --aura-line: ${profile.lineHeight};
  --aura-letter: ${(profile.letterSpacing || 0)}px;
  --aura-word: ${(profile.wordSpacing || 0)}px;
}
*, *::before, *::after {
  cursor: ${cursor} !important;
  font-family: ${profile.fontFamily} !important;
  font-size: ${profile.fontSize}px !important;
  line-height: ${profile.lineHeight} !important;
  letter-spacing: ${(profile.letterSpacing || 0)}px !important;
  word-spacing: ${(profile.wordSpacing || 0)}px !important;
  color: ${profile.textColor} !important;
  ${disableAnim ? 'animation: none !important; transition: none !important;' : ''}
}
html, body {
  background-color: ${profile.bgColor} !important;
}
${disableAnim ? `* { animation: none !important; transition: none !important; }` : ''}
      `;
    } catch (e) {
      safeWarn('AURA buildCSS error', e);
      return '';
    }
  }

  function injectGlobalStyle(profile) {
    try {
      const css = buildCSS(profile);
      if (!css) return;

      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.appendChild(document.createTextNode(css));

      const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
      head.appendChild(style);
      safeLog('AURA content: applied global style');
    } catch (e) {
      safeWarn('AURA content: injectGlobalStyle error', e);
    }
  }

  function injectIntoShadowRoots(profile) {
    try {
      if (!profile) return;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        }
      );

      const roots = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.shadowRoot) roots.push(node.shadowRoot);
      }

      const css = buildCSS(profile);
      roots.forEach(root => {
        if (!root) return;
        if (root.querySelector(`#${SHADOW_STYLE_ID}`)) return;
        try {
          const style = document.createElement('style');
          style.id = SHADOW_STYLE_ID;
          style.appendChild(document.createTextNode(css));
          root.appendChild(style);
        } catch (ee) {
          safeWarn('AURA content: injectIntoShadowRoots append error', ee);
        }
      });

      safeLog('AURA content: injected into shadow roots');
    } catch (e) {
      safeWarn('AURA content: injectIntoShadowRoots error', e);
    }
  }

  function removeInjectedStyles() {
    try {
      document.getElementById(STYLE_ID)?.remove();
      document.querySelectorAll(`#${SHADOW_STYLE_ID}`).forEach(el => el.remove());
      safeLog('AURA content: removed injected styles');
    } catch (e) { safeWarn('AURA content: removeInjectedStyles', e); }
  }

  function applyProfileToDocument(profile) {
    if (!profile) return;
    currentProfile = profile;
    try {
      document.getElementById(STYLE_ID)?.remove();
      if (isEnabled) {
        const activeProfile = getActiveProfile();
        injectGlobalStyle(activeProfile);
        injectIntoShadowRoots(activeProfile);
      }
    } catch (e) {
      safeWarn('AURA content: applyProfileToDocument error', e);
    }
  }

  // Auto-update profile every minute to check for night mode transitions
  function setupAutoModeUpdater() {
    setInterval(() => {
      if (autoNightModeEnabled && isEnabled && currentProfile) {
        const activeProfile = getActiveProfile();
        injectGlobalStyle(activeProfile);
        injectIntoShadowRoots(activeProfile);
      }
    }, 60000); // Check every minute
  }

  function scrapeSections() {
    try {
      const hs = [...document.querySelectorAll('h1,h2,h3')];
      const sections = [];
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i];
        const start = h;
        const end = hs[i+1] || null;
        let node = start.nextSibling;
        const parts = [];
        while (node && node !== end) {
          if (node.nodeType === 1) {
            const tag = node.tagName?.toLowerCase();
            if (!['nav','aside','footer','script','style','noscript'].includes(tag)) {
              parts.push(node.innerText || '');
            }
          } else if (node.nodeType === 3) {
            parts.push(node.textContent || '');
          }
          node = node.nextSibling;
        }
        const text = parts.join('\n').replace(/\s+\n/g, '\n').trim();
        if (text.length > 50) {
          sections.push({
            id: `sec_${i}`,
            heading: h.innerText.trim(),
            level: h.tagName.toLowerCase(),
            text: text.slice(0, 8000),
            anchor: h.id ? `#${h.id}` : null
          });
        }
      }
      return sections;
    } catch (e) {
      safeWarn('AURA content: scrapeSections failed', e);
      return [];
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || !msg.type) {
        try { sendResponse({ ok: false, error: 'no_type' }); } catch (e) {}
        return true;
      }

      if (msg.type === 'AURA_SCRAPE_SECTIONS') {
        try {
          const sections = scrapeSections();
          sendResponse({ sections, url: location.href, title: document.title });
        } catch (e) {
          sendResponse({ sections: [], url: location.href, title: document.title });
        }
        return true;
      }

      if (msg.type === 'AURA_APPLY_PROFILE') {
        try {
          applyProfileToDocument(msg.profile);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return true;
      }

      if (msg.type === 'AURA_TOGGLE_SOMETHING') {
        try { sendResponse({ ok: true }); } catch (e) {}
        return true;
      }

      if (msg.type === 'AURA_TOGGLE_PANEL') {
        safeLog('AURA content: received AURA_TOGGLE_PANEL — opening panel');
        try {
          auraOpenSidePanel();
          sendResponse({ ok: true });
        } catch (e) {
          safeWarn('AURA content: auraOpenSidePanel failed', e);
          try { sendResponse({ ok: false, error: String(e) }); } catch (ee) {}
        }
        return true;
      }

      try { sendResponse({ ok: false, error: 'unknown_message_type' }); } catch (e) {}
      return true;
    } catch (e) {
      safeWarn('AURA content: onMessage top-level error', e);
      try { sendResponse({ ok: false, error: String(e) }); } catch (ee) {}
      return true;
    }
  });

  function getCurrentProfileForPanel() {
    return new Promise((resolve) => {
      try {
        if (chrome && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['aura_profile'], (res) => {
            resolve(res?.aura_profile || null);
          });
        } else {
          const raw = localStorage.getItem('aura_profile');
          try { resolve(raw ? JSON.parse(raw) : null); } catch (e) { resolve(null); }
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  function auraGetPanelUrl() {
    try { return chrome.runtime.getURL('sidepanel.html'); } catch (e) { return 'sidepanel.html'; }
  }

  async function auraOpenSidePanel() {
    try {
      if (document.getElementById(SIDEPANEL_HOST_ID)) {
        auraShowSidePanel();
        return;
      }

      const backdrop = document.createElement('div');
      backdrop.id = SIDEPANEL_BACKDROP_ID;
      backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,.08); z-index: 2147483646;`;
      backdrop.addEventListener('click', auraCloseSidePanel);

      auraPanelHost = document.createElement('div');
      auraPanelHost.id = SIDEPANEL_HOST_ID;
      auraPanelHost.setAttribute('role', 'dialog');
      auraPanelHost.style.cssText = `position: fixed; top: 0; right: 0; height: 100vh; width: 380px; z-index: 2147483647; display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,.15); border-left: 1px solid #ececec; background: #fff;`;

      auraPanelIframe = document.createElement('iframe');
      auraPanelIframe.title = 'AURA side panel';
      auraPanelIframe.src = auraGetPanelUrl();
      auraPanelIframe.style.cssText = `width:100%; height:100%; border:0; background:#fff;`;

      document.body.appendChild(backdrop);
      document.body.appendChild(auraPanelHost);
      auraPanelHost.appendChild(auraPanelIframe);

      auraPanelIframe.addEventListener('load', async () => {
        try {
          auraPanelIframe.contentWindow?.focus();
          const profile = await getCurrentProfileForPanel();
          if (profile) {
            auraPanelIframe.contentWindow.postMessage({
              AURA_PROFILE_LOAD: true,
              profile: profile
            }, '*');
            safeLog('AURA content: sent profile to side panel');
          }
        } catch (e) { safeWarn('AURA content: iframe load send error', e); }
      });

      if (!window.__aura_panel_msg_installed) {
        window.addEventListener('message', (e) => {
          try { if (e?.data?.AURA_PANEL_CLOSE) auraCloseSidePanel(); } catch (er) {}
        }, { passive: true });
        window.__aura_panel_msg_installed = true;
      }

    } catch (e) {
      safeWarn('AURA content: auraOpenSidePanel error', e);
    }
  }

  function auraCloseSidePanel() {
    try {
      document.getElementById(SIDEPANEL_HOST_ID)?.remove();
      document.getElementById(SIDEPANEL_BACKDROP_ID)?.remove();
    } catch (e) {}
    auraPanelHost = null;
    auraPanelIframe = null;
  }

  function auraShowSidePanel() {
    const host = document.getElementById(SIDEPANEL_HOST_ID);
    const backdrop = document.getElementById(SIDEPANEL_BACKDROP_ID);
    if (host) host.style.display = 'flex';
    if (backdrop) backdrop.style.display = 'block';
  }

  function auraToggleSidePanel() {
    const host = document.getElementById(SIDEPANEL_HOST_ID);
    if (host && host.style.display !== 'none') auraCloseSidePanel();
    else auraOpenSidePanel();
  }

  const observer = new MutationObserver((mutations) => {
    try {
      if (!isEnabled || !currentProfile) return;
      let needsInject = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          needsInject = true;
          break;
        }
      }
      if (needsInject) {
        setTimeout(() => injectIntoShadowRoots(getActiveProfile()), 100);
      }
    } catch (e) { safeWarn('AURA MutationObserver error', e); }
  });

  function init() {
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['aura_profile', 'aura_enabled', 'aura_special_modes'], (res) => {
          try {
            isEnabled = typeof res.aura_enabled !== 'undefined' ? !!res.aura_enabled : true;
            if (res && res.aura_special_modes) {
              autoNightModeEnabled = res.aura_special_modes.autoNightModeEnabled || false;
              eyeComfortModeEnabled = res.aura_special_modes.eyeComfortModeEnabled || false;
            }
            if (res && res.aura_profile && isEnabled) {
              applyProfileToDocument(res.aura_profile);
            } else if (res && res.aura_profile) {
              currentProfile = res.aura_profile;
            }
          } catch (er) { safeWarn('AURA content: storage.get callback', er); }
        });

        chrome.storage.onChanged.addListener((changes, area) => {
          try {
            if (area === 'sync' && changes.aura_profile) {
              applyProfileToDocument(changes.aura_profile.newValue);
            }
            if (area === 'sync' && changes.aura_special_modes) {
              autoNightModeEnabled = changes.aura_special_modes.newValue?.autoNightModeEnabled || false;
              eyeComfortModeEnabled = changes.aura_special_modes.newValue?.eyeComfortModeEnabled || false;
              if (isEnabled && currentProfile) {
                const activeProfile = getActiveProfile();
                injectGlobalStyle(activeProfile);
                injectIntoShadowRoots(activeProfile);
              }
            }
            if (area === 'sync' && changes.aura_enabled) {
              const enabled = changes.aura_enabled.newValue !== false;
              isEnabled = enabled;
              if (!enabled) {
                removeInjectedStyles();
              } else if (currentProfile) {
                applyProfileToDocument(currentProfile);
              } else {
                chrome.storage.sync.get(['aura_profile'], (res) => {
                  if (res && res.aura_profile) applyProfileToDocument(res.aura_profile);
                });
              }
            }
          } catch (e) { safeWarn('AURA content: storage.onChanged error', e); }
        });
      } else {
        try {
          const raw = localStorage.getItem('aura_profile');
          if (raw) {
            const parsed = JSON.parse(raw);
            currentProfile = parsed;
            applyProfileToDocument(parsed);
          }
          const storedEnabled = localStorage.getItem('aura_enabled');
          isEnabled = storedEnabled === null ? true : storedEnabled !== 'false';
          if (!isEnabled) removeInjectedStyles();
          const modesRaw = localStorage.getItem('aura_special_modes');
          if (modesRaw) {
            const modes = JSON.parse(modesRaw);
            autoNightModeEnabled = modes.autoNightModeEnabled || false;
            eyeComfortModeEnabled = modes.eyeComfortModeEnabled || false;
          }
        } catch (e) { safeWarn('AURA local fallback error', e); }
      }

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }

      setupAutoModeUpdater();
    } catch (e) { safeWarn('AURA content: init error', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();