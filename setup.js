// Profiles with default settings
const profiles = [
  { id: 'dyslexia', name: 'Dyslexia', fontSize: 20, fontFamily: "'Verdana', 'Arial', sans-serif", bgColor: "#fffbe6", textColor: "#0b1b3a", lineHeight: 1.6, letterSpacing: 0.15, wordSpacing: 0.25, animations: false },
  { id: 'adhd', name: 'ADHD', fontSize: 18, fontFamily: "'Open Sans', sans-serif", bgColor: "#ffffff", textColor: "#111111", lineHeight: 1.4, letterSpacing: 0, wordSpacing: 0, animations: true },
  { id: 'autism', name: 'Autism Spectrum', fontSize: 19, fontFamily: "'Arial', sans-serif", bgColor: "#f6fbff", textColor: "#0b2a4a", lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0, animations: true },
  { id: 'lowvision', name: 'Low Vision', fontSize: 26, fontFamily: "'Verdana', sans-serif", bgColor: "#000000", textColor: "#ffffff", lineHeight: 1.5, letterSpacing: 0, wordSpacing: 0, animations: true },
  { id: 'colorblind', name: 'Color Blindness', fontSize: 18, fontFamily: "'Arial', sans-serif", bgColor: "#ffffff", textColor: "#000000", lineHeight: 1.5, letterSpacing: 0, wordSpacing: 0, animations: true },
  { id: 'fatigue', name: 'Cognitive Fatigue', fontSize: 18, fontFamily: "'Roboto', sans-serif", bgColor: "#f4f7f6", textColor: "#1b2b2b", lineHeight: 1.8, letterSpacing: 0, wordSpacing: 0, animations: true },
  { id: 'epilepsy', name: 'Epilepsy Sensitivity', fontSize: 18, fontFamily: "'Arial', sans-serif", bgColor: "#ffffff", textColor: "#000000", lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0, animations: false },
  { id: 'motor', name: 'Motor Coordination', fontSize: 18, fontFamily: "'Arial', sans-serif", bgColor: "#fffef6", textColor: "#0b1b3a", lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0, animations: true }
];

const profilesGrid = document.getElementById('profilesGrid');
const previewText = document.getElementById('previewText');
const previewBox = document.getElementById('previewBox');
const saveBtn = document.getElementById('saveBtn');
const openCustom = document.getElementById('openCustom');
const customPanel = document.getElementById('customPanel');

const fontFamilyEl = document.getElementById('fontFamily');
const fontSizeEl = document.getElementById('fontSize');
const fontSizeVal = document.getElementById('fontSizeVal');
const letterSpacingEl = document.getElementById('letterSpacing');
const letterSpacingVal = document.getElementById('letterSpacingVal');
const wordSpacingEl = document.getElementById('wordSpacing');
const wordSpacingVal = document.getElementById('wordSpacingVal');
const lineHeightEl = document.getElementById('lineHeight');
const lineHeightVal = document.getElementById('lineHeightVal');
const bgColorEl = document.getElementById('bgColor');
const textColorEl = document.getElementById('textColor');
const animationsCheckbox = document.getElementById('animationsCheckbox');
const saveCustom = document.getElementById('saveCustom');
const animationBox = document.getElementById('animationBox');
const animationStatus = document.getElementById('animationStatus');
const animationShowcase = document.querySelector('.animation-showcase');

let currentSelection = null;
let customSettings = {};

// Render profile cards
function renderProfiles(){
  profilesGrid.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${p.id}`;
    card.innerHTML = `<h3>${p.name}</h3><div class="meta">Default view</div>`;
    card.addEventListener('click', () => selectProfile(p));
    profilesGrid.appendChild(card);
  });
}

// Apply settings to preview
function applyToPreview(settings){
  previewBox.style.backgroundColor = settings.bgColor;
  previewText.style.color = settings.textColor;
  previewText.style.fontFamily = settings.fontFamily;
  previewText.style.fontSize = settings.fontSize + 'px';
  previewText.style.lineHeight = settings.lineHeight;
  previewText.style.letterSpacing = settings.letterSpacing + 'px';
  previewText.style.wordSpacing = settings.wordSpacing + 'px';
  
  // Handle animations
  if (settings.animations === false) {
    previewBox.classList.add('no-animations');
    previewText.classList.add('no-animations');
    animationBox.classList.add('no-animations');
    animationShowcase.classList.add('hidden-showcase');
    animationStatus.textContent = 'Animations: OFF';
    animationStatus.style.color = '#d32f2f';
  } else {
    previewBox.classList.remove('no-animations');
    previewText.classList.remove('no-animations');
    animationBox.classList.remove('no-animations');
    animationShowcase.classList.remove('hidden-showcase');
    animationStatus.textContent = 'Animations: ON';
    animationStatus.style.color = '#2e7d32';
  }
}

// Called when profile clicked
function selectProfile(profile){
  currentSelection = profile;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`card-${profile.id}`);
  if(card) card.classList.add('selected');
  applyToPreview(profile);
  updateCustomPanel(profile);
  updateProfileDisplay(profile);
}

// Update profile display
function updateProfileDisplay(profile) {
  const profileDisplay = document.getElementById('profileDisplay');
  if (profileDisplay) {
    profileDisplay.textContent = `Profile: ${profile.name || 'Custom'}`;
  }
}

// Update custom panel with profile values
function updateCustomPanel(profile) {
  fontFamilyEl.value = profile.fontFamily;
  fontSizeEl.value = profile.fontSize;
  fontSizeVal.textContent = profile.fontSize;
  letterSpacingEl.value = profile.letterSpacing || 0;
  letterSpacingVal.textContent = (profile.letterSpacing || 0).toFixed(1);
  wordSpacingEl.value = profile.wordSpacing || 0;
  wordSpacingVal.textContent = (profile.wordSpacing || 0).toFixed(1);
  lineHeightEl.value = profile.lineHeight;
  lineHeightVal.textContent = profile.lineHeight;
  bgColorEl.value = profile.bgColor;
  textColorEl.value = profile.textColor;
  animationsCheckbox.checked = profile.animations !== false;
}

// Toggle custom panel
openCustom.addEventListener('click', () => {
  customPanel.classList.toggle('hidden');
});

// Live preview updates
function updateCustomPreview() {
  const settings = {
    id: 'custom',
    name: 'Custom',
    fontSize: parseInt(fontSizeEl.value, 10),
    fontFamily: fontFamilyEl.value,
    bgColor: bgColorEl.value,
    textColor: textColorEl.value,
    lineHeight: parseFloat(lineHeightEl.value),
    letterSpacing: parseFloat(letterSpacingEl.value),
    wordSpacing: parseFloat(wordSpacingEl.value),
    animations: animationsCheckbox.checked
  };
  customSettings = settings;
  currentSelection = settings;
  applyToPreview(settings);
  updateProfileDisplay(settings);
}

// Add live update listeners
fontSizeEl.addEventListener('input', () => {
  fontSizeVal.textContent = fontSizeEl.value;
  updateCustomPreview();
});

letterSpacingEl.addEventListener('input', () => {
  letterSpacingVal.textContent = parseFloat(letterSpacingEl.value).toFixed(1);
  updateCustomPreview();
});

wordSpacingEl.addEventListener('input', () => {
  wordSpacingVal.textContent = parseFloat(wordSpacingEl.value).toFixed(1);
  updateCustomPreview();
});

lineHeightEl.addEventListener('input', () => {
  lineHeightVal.textContent = lineHeightEl.value;
  updateCustomPreview();
});

fontFamilyEl.addEventListener('change', updateCustomPreview);
bgColorEl.addEventListener('input', updateCustomPreview);
textColorEl.addEventListener('input', updateCustomPreview);
animationsCheckbox.addEventListener('change', updateCustomPreview);

// Save & Continue
function persistAndContinue(){
  const toSave = currentSelection ? currentSelection : customSettings;
  if(!toSave){
    alert('Please select or create a profile first.');
    return;
  }
  
  const prefs = {
    aura_profile: toSave
  };
  
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set(prefs, () => {
      window.location.href = 'popup.html';
    });
  } else {
    localStorage.setItem('aura_profile', JSON.stringify(toSave));
    window.location.href = 'popup.html';
  }
}

// Save button
saveBtn.addEventListener('click', persistAndContinue);
saveCustom.addEventListener('click', () => {
  updateCustomPreview();
  persistAndContinue();
});

// Initialize
renderProfiles();
selectProfile(profiles[0]);

// Load existing profile
if (chrome && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(['aura_profile'], (res) => {
    if (res && res.aura_profile) {
      currentSelection = res.aura_profile;
      applyToPreview(currentSelection);
      updateCustomPanel(currentSelection);
      const match = profiles.find(p => p.id === res.aura_profile.id);
      if (match) {
        document.getElementById(`card-${match.id}`).classList.add('selected');
      }
    }
  });
}