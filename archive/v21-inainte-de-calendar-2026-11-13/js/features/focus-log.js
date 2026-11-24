// Clockus — focus time log: tracking, saving, restoring the timer, merging devices
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Focus time tracking ----------
// Stored as { deviceId: { 'YYYY-MM-DD': milliseconds } }. Each device only ever
// increases its own numbers, so merging devices with "max" never loses time.
const focusLog = store.get('focus', {});
const deviceId = store.get('deviceId', null) || (() => {
    const id = Math.random().toString(36).slice(2, 10);
    store.set('deviceId', id);
    return id;
})();
let lastTickAt = null;
let lastFocusPush = 0;

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function fmtDuration(ms) {
    const total = Math.floor(ms / 60000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
}

// Refreshes the Stats tab while it is open (e.g. when the timer is running)
function updateStats() {
    if (document.body.dataset.tab === 'stats') renderStatsSoon();
}

// Keep only the last 365 days (today + the 364 days before it)
function pruneFocus() {
    const cutoff = dayKey(dateAgo(364));
    for (const days of Object.values(focusLog)) {
        for (const day of Object.keys(days)) if (day < cutoff) delete days[day];
    }
    store.set('focus', focusLog);
}

function addFocusMs(ms, when = Date.now()) {
    const mine = focusLog[deviceId] || (focusLog[deviceId] = {});
    const day = dayKey(new Date(when));
    mine[day] = Math.round((mine[day] || 0) + ms);
    store.set('focus', focusLog);
}

// Adds the time that passed since the last tick, only while a focus session runs
function accrueFocus() {
    if (!running || mode !== 'focus' || lastTickAt === null) return;
    const now = Math.min(Date.now(), endTime);
    const ms = now - lastTickAt;
    if (ms <= 0) return;
    lastTickAt = now;
    addFocusMs(ms);
    saveTimer();
    updateStats();
    if (Date.now() - lastFocusPush > 60000) {
        lastFocusPush = Date.now();
        pushSettings();
    }
}

// The running or paused timer survives a reload, a closed tab or a discarded background tab
function saveTimer() {
    store.set('timer', running || paused
        ? { mode, running, paused, endTime, remaining, tickAt: lastTickAt }
        : null);
}

function restoreTimer() {
    const s = store.get('timer', null);
    if (!s || typeof s !== 'object' || (s.mode !== 'focus' && s.mode !== 'break')) return;
    mode = s.mode;

    if (!s.running) {
        if (s.paused) {
            remaining = Math.max(0, Number(s.remaining)) || duration();
            paused = true;
        } else {
            mode = 'focus';
        }
        return;
    }

    let end = Number(s.endTime);
    let from = Number(s.tickAt) || null;
    if (!Number.isFinite(end)) { mode = 'focus'; return; }
    const now = Date.now();

    // Catch up on what happened while the page was closed
    while (end <= now) {
        if (mode === 'focus') {
            if (from && end > from) addFocusMs(end - from, end);   // focus time up to the end of the session
            mode = 'break';                                         // the break started on its own
            from = null;
            end += settings.brk * 60000;
        } else {
            mode = 'focus';                                         // break over: ready for the next session
            remaining = duration();
            saveTimer();
            updateStats();
            return;
        }
    }

    if (mode === 'focus' && from && now > from) addFocusMs(now - from, now);
    endTime = end;
    remaining = end - now;
    running = true;
    paused = false;
    lastTickAt = now;
    tick = setInterval(update, 250);
    saveTimer();
    updateStats();
}

function mergeFocus(remote) {
    if (!remote || typeof remote !== 'object') return;
    for (const [dev, days] of Object.entries(remote)) {
        if (!/^[a-z0-9]{1,16}$/.test(dev) || !days || typeof days !== 'object') continue;
        const mine = focusLog[dev] || (focusLog[dev] = {});
        for (const [day, ms] of Object.entries(days)) {
            const v = Number(ms);
            if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(v) && v > (mine[day] || 0)) mine[day] = v;
        }
    }
    pruneFocus();
    store.set('focus', focusLog);
    updateStats();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        accrueFocus();
        pushSettings();
    }
});
window.addEventListener('pagehide', accrueFocus);
