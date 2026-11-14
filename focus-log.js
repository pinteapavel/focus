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

// Longest unbroken focus run of each day on this device: { 'YYYY-MM-DD': milliseconds }
// (a pause, a stop or midnight starts a new run). Used by the "Longest session" record.
const focusLongest = store.get('focusLongest', {});
let runMs = 0;
let runEnd = 0;

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
    if (document.body.dataset.tab === 'calendar') renderCalendarSoon();
    refreshGoalLineSoon();
}

// ---------- Focus sessions (shown in the Calendar) ----------
// [{ id: '<deviceId>-<start ms>', s: start ms, e: end ms, t: task id or null, x: task text }]
// Each device only adds or extends its own sessions; devices merge by id.
const SESSION_DAYS = 120;          // kept on the device and synced
const SESSION_GAP = 120000;        // a pause shorter than 2 minutes continues the same session
let sessions = store.get('sessions', []);
if (!Array.isArray(sessions)) sessions = [];
let sessionsSavedAt = 0;

function saveSessions() {
    sessionsSavedAt = Date.now();
    store.set('sessions', sessions);
}

function logSession(from, to) {
    if (to <= from) return;
    const taskId = currentTaskId;
    const prefix = deviceId + '-';
    let last = null;
    for (let i = sessions.length - 1; i >= 0 && i >= sessions.length - 30; i--) {
        if (sessions[i].id.startsWith(prefix)) { last = sessions[i]; break; }
    }
    if (last && from >= last.s && from - last.e <= SESSION_GAP && last.t === taskId
        && dayKey(new Date(last.s)) === dayKey(new Date(from))) {
        last.e = Math.max(last.e, Math.round(to));
        if (Date.now() - sessionsSavedAt > 5000) saveSessions();
        return;
    }
    const task = tasks.find((x) => x.id === taskId);
    sessions.push({ id: prefix + Math.round(from), s: Math.round(from), e: Math.round(to), t: taskId, x: task ? task.text : '' });
    saveSessions();
}

function mergeSessions(remote) {
    if (!Array.isArray(remote)) return;
    const byId = new Map(sessions.map((s) => [s.id, s]));
    remote.forEach((r) => {
        if (!r || typeof r.id !== 'string' || !/^[a-z0-9]{1,16}-\d{1,16}$/.test(r.id)) return;
        const s = Number(r.s);
        const e = Number(r.e);
        if (!Number.isFinite(s) || !Number.isFinite(e) || e < s || e - s > 86400000) return;
        const mine = byId.get(r.id);
        if (mine) { mine.e = Math.max(mine.e, e); return; }
        byId.set(r.id, {
            id: r.id, s, e,
            t: Number.isFinite(Number(r.t)) && r.t !== null ? Number(r.t) : null,
            x: typeof r.x === 'string' ? r.x.slice(0, 120) : ''
        });
    });
    sessions = [...byId.values()].sort((a, b) => a.s - b.s);
    pruneSessions();
}

function pruneSessions() {
    const cutoff = Date.now() - SESSION_DAYS * 86400000;
    sessions = sessions.filter((s) => s.e >= cutoff);
    saveSessions();
}

// Keep only the last 365 days (today + the 364 days before it)
function pruneFocus() {
    const cutoff = dayKey(dateAgo(364));
    archiveOldFocus(cutoff);           // records and the all-time total keep what is removed below
    for (const days of Object.values(focusLog)) {
        for (const day of Object.keys(days)) if (day < cutoff) delete days[day];
    }
    for (const day of Object.keys(focusLongest)) if (day < cutoff) delete focusLongest[day];
    store.set('focus', focusLog);
    store.set('focusLongest', focusLongest);
    pruneSessions();
}

function addFocusMs(ms, when = Date.now()) {
    const mine = focusLog[deviceId] || (focusLog[deviceId] = {});
    const day = dayKey(new Date(when));
    mine[day] = Math.round((mine[day] || 0) + ms);
    store.set('focus', focusLog);
    // The run continues only if this piece starts where the last one ended, on the same day
    const continues = Math.abs(when - ms - runEnd) < 1500 && dayKey(new Date(runEnd)) === day;
    runMs = continues ? runMs + ms : ms;
    runEnd = when;
    if (runMs > (focusLongest[day] || 0)) {
        focusLongest[day] = Math.round(runMs);
        store.set('focusLongest', focusLongest);
    }
    logSession(when - ms, when);
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
        saveSessions();
        pushSettings();
    }
});
window.addEventListener('pagehide', () => { accrueFocus(); saveSessions(); });
