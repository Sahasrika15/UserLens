// background.js (further hardened)
const DEFAULT_TIMEOUT_MS = 3500; // if tab doesn't respond in time, bail

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
  }
  chrome.contextMenus.create({
    id: "aura-toggle-panel",
    title: "AURA: Open side panel",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "aura-toggle-panel" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'AURA_TOGGLE_PANEL' }, (resp) => {
      if (chrome.runtime.lastError) {
        // The content script might not be injected on this page (or blocked).
        console.warn('AURA background: toggle sendMessage lastError:', chrome.runtime.lastError.message);
      } else {
        console.log('AURA background: toggle acknowledged');
      }
    });
  }
});

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

function norm(str){ return (str||'').toLowerCase().replace(/[^a-z0-9\s]/g,' '); }
function tokenize(str){ return norm(str).split(/\s+/).filter(Boolean); }
function scoreChunk(q, chunk){
  const qTokens = tokenize(q);
  const text = (chunk.text||'').toLowerCase();
  const head = (chunk.heading||'').toLowerCase();

  let tf = 0;
  let headHits = 0;
  for (const t of qTokens){
    const re = new RegExp(`\\b${t}\\b`,'g');
    tf += (text.match(re)||[]).length;
    headHits += (head.match(re)||[]).length * 2;
  }
  const lenPenalty = Math.log10(Math.max(200, text.length || 0));
  return (tf + headHits) / (lenPenalty || 1);
}
function pickTopChunks(question, sections, k=2){
  const scored = (sections||[]).map(s => ({ s, score: scoreChunk(question, s) }));
  scored.sort((a,b)=> b.score - a.score);
  return scored.slice(0,k).map(x => x.s);
}

async function askLLM({question, contextBlocks, pageInfo}) {
  // mock LLM — replace with real API if needed.
  return {
    tldr: "This page explains the core steps briefly.",
    bullets: [
      "Identify the topic section.",
      "Read the steps under headings.",
      "Follow procedures in order.",
      "Check limitations if listed."
    ],
    details: "Source text was used from the most relevant two sections.",
    citations: (contextBlocks||[]).slice(0,1).map(c => ({
      heading: c?.heading || "Unknown",
      anchor: c?.anchor || ""
    }))
  };
}

// helper: ask tab for sections with timeout and lastError handling
function askTabForSections(tabId) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ error: 'timeout', sections: [], url: '', title: '' });
      }
    }, DEFAULT_TIMEOUT_MS);

    try {
      chrome.tabs.sendMessage(tabId, { type:'AURA_SCRAPE_SECTIONS' }, (resp) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message, sections: [], url: '', title: '' });
        } else {
          resolve({ sections: resp?.sections || [], url: resp?.url || '', title: resp?.title || '' });
        }
      });
    } catch (e) {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve({ error: String(e), sections: [], url: '', title: '' });
      }
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'AURA_PANEL_ASK') {
        // keep channel open
        const tabId = sender.tab?.id || await getActiveTabId();
        if (!tabId) {
          sendResponse({ tldr:'Error', bullets:['No active tab found'], details:'' });
          return;
        }

        // Ask tab for sections (with timeout)
        const tabResp = await askTabForSections(tabId);
        if (tabResp.error) {
          console.warn('AURA background: askTabForSections error:', tabResp.error);
          sendResponse({ tldr:'Error', bullets:[tabResp.error], details:'' });
          return;
        }

        try {
          const top = pickTopChunks(msg.question, tabResp.sections, 2);
          const data = await askLLM({
            question: msg.question,
            contextBlocks: top,
            pageInfo: { url: tabResp.url || '', title: tabResp.title || '' }
          });
          sendResponse(data);
          return;
        } catch (e) {
          console.error('AURA_PANEL_ASK LLM error', e);
          sendResponse({ tldr:'Error', bullets:[String(e)], details:'' });
          return;
        }
      }

      if (msg.type === 'AURA_SCRAPE_FROM_TAB') {
        const tabId = sender.tab?.id || await getActiveTabId();
        if (!tabId) {
          sendResponse({ sections: [], url: '', title: '' });
          return;
        }
        const tabResp = await askTabForSections(tabId);
        sendResponse({ sections: tabResp.sections || [], url: tabResp.url || '', title: tabResp.title || '' });
        return;
      }

      if (msg.type === 'AURA_PICK_CHUNKS') {
        const top = pickTopChunks(msg.question, msg.sections, 2);
        sendResponse(top);
        return;
      }

      if (msg.type === 'AURA_TTS') {
        try {
          chrome.tts.speak(msg.text || "", { enqueue: false, rate: 1.0, pitch: 1.0 });
        } catch (e) {
          console.warn('AURA background: tts error', e);
        }
        // no response needed
        return;
      }
    } catch (e) {
      console.error('AURA background: unexpected handler error', e);
      try { sendResponse({ tldr:'Error', bullets:[String(e)], details:'' }); } catch {}
    }
  })();
  return true; // important for async sendResponse
});
