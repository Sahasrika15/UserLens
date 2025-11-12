// sidePanel.js (fixed / defensive)
(() => {
  // Grab elements (some may be missing in older html variations — defend)
  const form = document.getElementById('askForm');
  const askBtn = document.getElementById('ask');
  const q = document.getElementById('q');
  const ans = document.getElementById('answer');
  const statusEl = document.getElementById('status');
  const copyBtn = document.getElementById('copy');
  const speakBtn = document.getElementById('speak');
  const closeBtn = document.getElementById('closeBtn');
  const largeText = document.getElementById('largeText');

  // Helper to set status text
  function setStatus(text, temporary = true) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    if (temporary && text) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(() => statusEl.textContent = '', 2000);
    }
  }

  // Focus first field on load
  try { q?.focus(); } catch (e) { /* ignore */ }

  // Esc closes
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') parent.postMessage({ AURA_PANEL_CLOSE: true }, '*');
  });

  // Simple focus trap inside the panel
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = [...document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => parent.postMessage({ AURA_PANEL_CLOSE: true }, '*'));
  }

  // Large text toggle
  if (largeText) {
    largeText.addEventListener('change', () => {
      const root = document.getElementById('root');
      if (!root) return;
      root.style.fontSize = largeText.checked ? '18px' : '14px';
      root.style.lineHeight = largeText.checked ? '1.7' : '1.6';
    });
    // apply initial state
    largeText.dispatchEvent(new Event('change'));
  }

  // helper that sends message to background and handles lastError
  function askBackground(question) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'AURA_PANEL_ASK', question }, (resp) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(resp);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // If no form exists, fallback to button click
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = q?.value?.trim();
      if (!question) return;
      if (askBtn) askBtn.disabled = true;
      if (ans) ans.textContent = 'Thinking…';
      setStatus('');
      try {
        const data = await askBackground(question);
        renderAnswer(data);
      } catch (err) {
        if (ans) ans.textContent = '';
        setStatus('Could not get an answer.');
        console.error('Panel ask error', err);
      } finally {
        if (askBtn) askBtn.disabled = false;
        q?.focus();
      }
    });
  } else if (askBtn) {
    askBtn.addEventListener('click', async () => {
      const question = q?.value?.trim();
      if (!question) return;
      askBtn.disabled = true;
      if (ans) ans.textContent = 'Thinking…';
      setStatus('');
      try {
        const data = await askBackground(question);
        renderAnswer(data);
      } catch (err) {
        if (ans) ans.textContent = '';
        setStatus('Could not get an answer.');
        console.error('Panel ask error', err);
      } finally {
        askBtn.disabled = false;
        q?.focus();
      }
    });
  }

  function renderAnswer(data) {
    if (!ans) return;
    if (!data) { ans.textContent = 'No answer.'; return; }
    const cite = (data.citations && data.citations[0]) ? data.citations[0] : null;
    ans.innerHTML = `
      <div><strong>TL;DR:</strong> ${escapeHtml(data.tldr || '—')}</div>
      <ul style="margin:8px 0 0 18px">${(data.bullets||[]).slice(0,5).map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>
      ${data.details ? `<details style="margin-top:8px"><summary>If you need details</summary><div style="margin-top:6px">${escapeHtml(data.details)}</div></details>` : ''}
      ${cite ? `<div style="margin-top:8px;font-size:12px;color:#555">Source: <em>${escapeHtml(cite.heading||'Unknown')}</em></div>` : ''}
    `;
    setStatus('Answer loaded', true);
  }

  // Escape HTML to be safe
  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Copy & Speak
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(ans?.innerText || '');
        setStatus('Copied.');
      } catch {
        setStatus('Copy failed.');
      }
    });
  }

  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ type:'AURA_TTS', text: (ans?.innerText || '').slice(0, 1000) });
        setStatus('Speaking…', true);
      } catch (e) {
        setStatus('Speech failed.');
      }
    });
  }

})();
