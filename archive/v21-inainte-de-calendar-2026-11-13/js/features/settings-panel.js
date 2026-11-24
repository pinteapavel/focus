// Clockus — settings side panel (open / close)
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Settings panel ----------
const settingsBtn = $('settings-btn');
const settingsPanel = $('settings-panel');
const settingsClose = $('settings-close');
const overlay = $('overlay');

function setPanel(open) {
    settingsPanel.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    settingsPanel.setAttribute('aria-hidden', String(!open));
    settingsBtn.setAttribute('aria-expanded', String(open));
    (open ? settingsClose : settingsBtn).focus();
}

settingsBtn.addEventListener('click', () => setPanel(true));
settingsClose.addEventListener('click', () => setPanel(false));
overlay.addEventListener('click', () => setPanel(false));
