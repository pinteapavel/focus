// Clockus — Settings tab: categories, phone view, export and reset
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// The settings themselves (theme, fonts, accent...) are handled in appearance.js and the account in auth.js.

const setNavItems = document.querySelectorAll('.set-nav-item');
const setCards = document.querySelectorAll('.set-card');
const phoneSettings = window.matchMedia('(max-width: 700px)');

// Desktop: all categories on one page, the list scrolls to one. Phone: the list opens one category at a time.
function openSettingsSection(sec) {
    const card = $(`set-${sec}`);
    if (phoneSettings.matches) {
        settingsContainer.dataset.open = sec;
        window.scrollTo(0, 0);
        const back = card.querySelector('.set-back');
        if (back) back.focus();
    } else {
        card.scrollIntoView({ behavior: ui.animations ? 'smooth' : 'auto', block: 'start' });
        markSettingsNav(sec);
    }
}

function closeSettingsSection() {
    const sec = settingsContainer.dataset.open;
    delete settingsContainer.dataset.open;
    const item = sec && document.querySelector(`.set-nav-item[data-sec="${sec}"]`);
    if (item) item.focus();
}

function markSettingsNav(sec) {
    setNavItems.forEach((b) => {
        const on = b.dataset.sec === sec;
        b.classList.toggle('on', on);
        if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
}

setNavItems.forEach((b) => b.addEventListener('click', () => openSettingsSection(b.dataset.sec)));
document.querySelectorAll('.set-back').forEach((b) => b.addEventListener('click', closeSettingsSection));
phoneSettings.addEventListener('change', () => delete settingsContainer.dataset.open);

// Desktop: the category you are reading is highlighted while you scroll
window.addEventListener('scroll', () => {
    if (document.body.dataset.tab !== 'settings' || phoneSettings.matches) return;
    let current = setCards[0].dataset.sec;
    setCards.forEach((c) => { if (c.getBoundingClientRect().top < 140) current = c.dataset.sec; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = setCards[setCards.length - 1].dataset.sec;
    markSettingsNav(current);
}, { passive: true });

// Phone list: a short summary next to each category ("Dark · Violet", "Sora · 24h", "Synced")
function renderSettingsSummary() {
    const name = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const swatch = [...document.querySelectorAll('.swatch[data-color]')].find((b) => b.dataset.color.toLowerCase() === ui.accent.toLowerCase());
    const themeTile = document.querySelector(`[data-theme-choice="${ui.theme}"] .set-tile-name`);
    $('sum-appearance').textContent = `${themeTile ? themeTile.textContent : name(ui.theme)} · ${swatch ? swatch.getAttribute('aria-label') : 'Custom'}`;
    const font = document.querySelector(`[data-font-choice="${ui.font}"] span:last-child`);
    $('sum-clock').textContent = `${font ? font.textContent : ''} · ${ui.format}h`;
    $('sum-account').textContent = typeof user !== 'undefined' && user ? 'Synced' : 'Signed out';
}

// ---------- Export my data: one JSON file with tasks and focus history ----------
$('export-btn').addEventListener('click', () => {
    const data = {
        app: 'Clockus',
        exportedAt: new Date().toISOString(),
        tasks: tasks.map((t) => ({
            text: t.text, done: t.done, doneOn: t.doneOn || null,
            date: t.date || null, time: t.time || null, minutes: t.time ? t.dur || DEFAULT_DUR : null
        })),
        focusByDay: Object.fromEntries(Object.entries(totalsByDay()).sort().map(([d, ms]) => [d, Math.round(ms / 60000)])),
        sessions: sessions.map((s) => ({ start: new Date(s.s).toISOString(), end: new Date(s.e).toISOString(), task: s.x || null })),
        goals,
        timer: { focus: settings.focus, break: settings.brk }
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `clockus-data-${dayKey()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- Reset on this device: clears local data only, the cloud copy stays ----------
$('reset-btn-local').addEventListener('click', async () => {
    const msg = user
        ? 'Clear all Clockus data on this device? Your cloud copy stays, and you will need to sign in again.'
        : 'Clear all Clockus data on this device? You are not signed in, so your tasks and focus history will be gone.';
    if (!window.confirm(msg)) return;
    if (user) await flushSettings();   // send the last changes first
    store.set = () => {};              // nothing may write back while the page closes (e.g. the focus log)
    try { localStorage.clear(); } catch {}
    location.reload();
});
