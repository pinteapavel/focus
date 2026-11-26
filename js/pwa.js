// Clockus — installable app and offline use (the service worker is /sw.js)
// Loaded as a classic script (shared global scope), after sync.js and auth.js. Load order is set in app.html.
//
// - Registers the service worker for /app, so the app opens without a connection.
// - A new version after a deploy takes over by itself. The page reloads only while it is hidden,
//   so nobody is interrupted (the timer, tasks and settings are kept in this browser and come back).
// - Offline: a warning toast says so; the timer, clock and tasks keep working from this browser's storage.
//   Back online: the changes made meanwhile are sent to Supabase (loadCloud sends what is waiting first).
// - "Install": shown only when the browser offers it (beforeinstallprompt), hidden once installed.
//   iPhone / iPad have no such event: a short hint says how to add it to the Home Screen.

// ---------- Service worker ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloadWhenHidden = false;

    navigator.serviceWorker.register('/sw.js', { scope: '/app' }).then((reg) => {
        // Look for a new version whenever the app comes back to the front
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch((err) => console.warn('Service worker not registered:', err));

    // Download the ambient sounds for offline use once the app is ready (they are large: not at install)
    navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage('cache-sounds'); });

    // A new version took over: reload the next time the page is hidden (not in front of the person)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;   // first install: this page is already the current version
        reloadWhenHidden = true;
        if (document.hidden) location.reload();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && reloadWhenHidden) location.reload(); });
}

// ---------- Offline ----------
// A warning toast (js/core/toast.js): stays while there is no connection, goes away by itself when it is back
let offlineToast = null;

function renderOnline() {
    if (!navigator.onLine && !(offlineToast && offlineToast.isOpen())) {
        offlineToast = showToast({ type: 'warning', id: 'offline', title: 'You’re offline', text: 'Changes sync when you’re back.' });
    } else if (navigator.onLine && offlineToast) {
        offlineToast.close();
        offlineToast = null;
    }
}

window.addEventListener('offline', renderOnline);
window.addEventListener('online', () => {
    renderOnline();
    if (typeof loadCloud === 'function' && user) loadCloud();   // sends what waited, then brings in the rest
});
renderOnline();

// ---------- Install ----------
const installRow = $('install-row');
const installBtn = $('install-btn');
const installNote = $('install-note');
const amInstall = $('am-install');
const amInstallHint = $('am-install-hint');
let installPrompt = null;

const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
// iPhone, iPad (iPadOS reports itself as a Mac with touch)
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IOS_HINT = 'Tap Share, then Add to Home Screen.';

function renderInstall() {
    const installed = isStandalone();
    const canPrompt = !installed && !!installPrompt;
    const iosHint = !installed && !installPrompt && isIos;
    installRow.hidden = !canPrompt && !iosHint;
    installBtn.hidden = !canPrompt;
    installNote.textContent = iosHint ? IOS_HINT : 'Opens in its own window and works offline.';
    amInstall.hidden = !canPrompt;
    amInstallHint.hidden = !iosHint;
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();   // our own button instead of the browser's banner
    installPrompt = e;
    renderInstall();
});

window.addEventListener('appinstalled', () => {
    installPrompt = null;
    renderInstall();
});

async function askInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;   // the browser allows the prompt only once
    prompt.prompt();
    try { await prompt.userChoice; } catch {}
    renderInstall();
}

installBtn.addEventListener('click', askInstall);
amInstall.addEventListener('click', () => { setAccountMenu(false); askInstall(); });
if (window.matchMedia) window.matchMedia('(display-mode: standalone)').addEventListener('change', renderInstall);
renderInstall();
