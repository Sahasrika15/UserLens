// content.js (further hardened + CSP-safe)
console.log('AURA content: loaded on', location.href);

(function(){
  // safe helpers
  function safeLog(...args){ try { console.log(...args); } catch(e){} }
  function safeWarn(...args){ try { console.warn(...args); } catch(e){} }

  // Apply style profile — inject only a <style> element (not scripts)
  function applyProfileToDocument(profile) {
    if (!profile) return;
    try {
      const existing = document.getElementById('aura-style-override');
      if (existing) existing.remove();

      const style = document.createElement('style');
      style.id = 'aura-style-override';

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
      `;

      // Add textNode for CSS (style injections are allowed; CSP blocks inline *scripts*)
      style.appendChild(document.createTextNode(css));
      // append to head to be safer
      const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
      head.appendChild(style);
      safeLog('AURA content: applied profile');
    } catch (e) {
      safeWarn('AURA content: applyProfileToDocument error', e);
    }
  }

  // Scrape page headings -> sections
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

  // Single onMessage listener — always responds (either sync or async), and returns true when async
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || !msg.type) {
        // ignore unknown messages
        return;
      }

      if (msg.type === 'AURA_SCRAPE_SECTIONS') {
        // synchronous response (fast)
        try {
          const sections = scrapeSections();
          sendResponse({ sections, url: location.href, title: document.title });
        } catch (e) {
          sendResponse({ sections: [], url: location.href, title: document.title });
        }
        return; // no need to return true for sync response
      }

      if (msg.type === 'AURA_APPLY_PROFILE') {
        try {
          applyProfileToDocument(msg.profile);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        return;
      }

      if (msg.type === 'AURA_TOGGLE_SOMETHING') {
        // example placeholder: respond quickly
        sendResponse({ ok: true });
        return;
      }

      // unknown type -> no response
    } catch (e) {
      // ensure we never leave the caller hanging; attempt to respond with an error
      try { sendResponse({ error: String(e) }); } catch (xx) {}
    }
    // no return true here unless we plan to call sendResponse asynchronously
  });

  // Storage init & listener
  function init() {
    function doApply(profile) {
      try {
        chrome.storage.sync.get(['aura_enabled'], (res) => {
          const enabled = res && typeof res.aura_enabled !== 'undefined' ? res.aura_enabled : true;
          if (enabled) applyProfileToDocument(profile);
        });
      } catch (e) {
        safeWarn('AURA content: doApply error', e);
      }
    }

    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['aura_profile'], (res) => {
        try {
          if (res && res.aura_profile) {
            doApply(res.aura_profile);
          }
        } catch (e) { safeWarn(e); }
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
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
        } catch (e) { safeWarn('AURA content: storage.onChanged error', e); }
      });
    } else {
      const raw = localStorage.getItem('aura_profile');
      if (raw) {
        try { applyProfileToDocument(JSON.parse(raw)); } catch(e) {}
      }
    }
  }

  // Side panel iframe control (same as before but defensive)
  let auraPanelHost = null;
  let auraPanelIframe = null;
  function auraGetPanelUrl(){
    return chrome.runtime.getURL('sidepanel.html');
  }
  function auraOpenSidePanel() {
    if (document.getElementById('aura-sidepanel-host')) {
      auraShowSidePanel();
      return;
    }
    try {
      const backdrop = document.createElement('div');
      backdrop.id = 'aura-sidepanel-backdrop';
      backdrop.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,.08); z-index: 2147483646;`;
      backdrop.addEventListener('click', auraCloseSidePanel);

      auraPanelHost = document.createElement('div');
      auraPanelHost.id = 'aura-sidepanel-host';
      auraPanelHost.setAttribute('role', 'dialog');
      auraPanelHost.style.cssText = `position: fixed; top: 0; right: 0; height: 100vh; width: 380px; z-index: 2147483647; display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,.15); border-left: 1px solid #ececec; background: #fff;`;

      auraPanelIframe = document.createElement('iframe');
      auraPanelIframe.title = 'AURA side panel';
      auraPanelIframe.src = auraGetPanelUrl(); // use src (no inline script)
      auraPanelIframe.style.cssText = `width:100%; height:100%; border:0; background:#fff;`;

      document.body.appendChild(backdrop);
      document.body.appendChild(auraPanelHost);
      auraPanelHost.appendChild(auraPanelIframe);

      auraPanelIframe.addEventListener('load', () => {
        try { auraPanelIframe.contentWindow?.focus(); } catch (e) {}
      });

      window.addEventListener('message', (e) => {
        try { if (e?.data?.AURA_PANEL_CLOSE) auraCloseSidePanel(); } catch(e){}
      }, { passive: true });
    } catch (e) {
      safeWarn('AURA content: auraOpenSidePanel error', e);
    }
  }
  function auraCloseSidePanel() {
    try {
      document.getElementById('aura-sidepanel-host')?.remove();
      document.getElementById('aura-sidepanel-backdrop')?.remove();
    } catch(e){}
    auraPanelHost = null;
    auraPanelIframe = null;
  }
  function auraShowSidePanel(){
    const host = document.getElementById('aura-sidepanel-host');
    const backdrop = document.getElementById('aura-sidepanel-backdrop');
    if (host) host.style.display = 'flex';
    if (backdrop) backdrop.style.display = 'block';
  }
  function auraToggleSidePanel(){
    const host = document.getElementById('aura-sidepanel-host');
    if (host && host.style.display !== 'none') auraCloseSidePanel();
    else auraOpenSidePanel();
  }

  // Listen for toggle message
  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (msg?.type === 'AURA_TOGGLE_PANEL') {
        safeLog('AURA content: received AURA_TOGGLE_PANEL');
        auraToggleSidePanel();
      }
    } catch(e){ safeWarn(e); }
  });

  // run init
  init();
})();
