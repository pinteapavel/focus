// Clockus — cloud sync with Supabase (tasks, settings, focus log), and sync between tabs of one browser
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// How devices stay in step:
// - Tasks are rows in the `tasks` table. A change that could not be uploaded (offline) is remembered
//   ("dirty") and sent again on the next sync, so it is never replaced by the older cloud copy.
// - Everything else is one JSON record in `user_settings`. Before saving it, the app reads the cloud copy
//   and merges it, so one device never wipes out what another saved in the meantime:
//   focus time and sessions add up per device, the plan of each task / the look / the timer / the goals
//   keep the newest change (each carries the time it was changed).

// ---------- Cloud sync (Supabase) ----------
const SUPABASE_URL = 'https://bdlrjmcrmlaqwuzynvtz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vWR5en-EDQdOO66ZbOzklQ_E1PdcAKI';

const googleBtn = $('google-btn');
const signoutBtn = $('signout-btn');
const accountOut = $('account-out');
const accountIn = $('account-in');
const accountEmail = $('account-email');
const accountNote = $('account-note');
const syncStatus = $('sync-status');

let sb = null;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch {}
let user = null;
let pending = 0;

const toRow = (t) => ({ id: t.id, text: t.text, done: t.done, done_on: t.doneOn });
const fromRow = (r) => ({ id: Number(r.id), text: r.text, done: r.done, doneOn: r.done_on });

// Settings › Account and data: a short state ("Up to date") and when the last sync worked
let lastSyncedAt = 0;
function setSync(msg) {
    const ok = msg === 'Synced';
    if (ok) lastSyncedAt = Date.now();
    syncStatus.textContent = ok ? 'Up to date' : msg.startsWith('Syncing') ? 'Syncing…' : msg.startsWith('Offline') ? 'Offline'
        : msg === 'Not signed in' ? msg : 'Not synced';
    syncStatus.parentElement.dataset.state = ok ? 'ok' : msg.startsWith('Syncing') ? 'busy' : 'off';
    syncStatus.parentElement.title = msg;
    renderSyncWhen();
    if (typeof renderAccountMenu === 'function') renderAccountMenu();   // the avatar menu in the top bar
}

function renderSyncWhen() {
    const el = $('sync-when');
    if (!user) { el.textContent = 'Sign in to sync.'; return; }
    if (!lastSyncedAt) { el.textContent = 'Changes are saved on this device and sent when you are online.'; return; }
    const min = Math.floor((Date.now() - lastSyncedAt) / 60000);
    el.textContent = `Last synced ${min < 1 ? 'a moment ago' : min < 60 ? `${min} min ago` : `at ${clockTime(lastSyncedAt)}`}.`;
}
setInterval(renderSyncWhen, 30000);

// Runs one request; true when it worked
async function track(query) {
    pending++;
    try {
        const { error } = await query;
        setSync(error ? 'Sync failed. Changes are saved on this device.' : 'Synced');
        return !error;
    } catch {
        setSync('Offline. Changes are saved on this device.');
        return false;
    } finally {
        pending--;
    }
}

// ---------- Tasks not uploaded yet ----------
// up: tasks added or changed here since their last successful upload; del: tasks deleted here
const dirtyUp = new Set(store.get('dirtyUp', []));
const dirtyDel = new Set(store.get('dirtyDel', []));
const upSeq = {};
function saveDirty() {
    store.set('dirtyUp', [...dirtyUp]);
    store.set('dirtyDel', [...dirtyDel]);
}

function cloudUpsert(t) {
    dirtyUp.add(t.id);   // also when signed out: uploaded at the next sign-in
    saveDirty();
    if (!sb || !user) return;
    const seq = upSeq[t.id] = (upSeq[t.id] || 0) + 1;
    track(sb.from('tasks').upsert(toRow(t))).then((ok) => {
        if (ok && upSeq[t.id] === seq) { dirtyUp.delete(t.id); saveDirty(); }   // only if not changed again meanwhile
    });
}

function cloudDelete(ids) {
    if (!ids.length) return;
    ids.forEach((id) => { dirtyUp.delete(id); dirtyDel.add(id); });
    saveDirty();
    if (!sb || !user) return;
    track(sb.from('tasks').delete().in('id', ids)).then((ok) => {
        if (ok) { ids.forEach((id) => dirtyDel.delete(id)); saveDirty(); }
    });
}

// ---------- Settings record ----------
function settingsPayload() {
    return { timer: settings, ui, order: tasks.map((t) => t.id), focus: focusLog, plan: planMap(), planV: 3, sessions, goals: goalsPayload() };
}

// The other version wins when it is at least as new (records from older versions have no time: 0)
const isNewer = (remote, local) => (Number(remote && remote.at) || 0) >= (Number(local && local.at) || 0);

// Brings in what another device saved. Safe to run any time: nothing newer on this device is replaced.
// quiet: the caller redraws the task list itself.
function applyRemoteSettings(data, opts = {}) {
    if (data.focus) mergeFocus(data.focus);
    if (data.sessions) { mergeSessions(data.sessions); refreshCalendar(); }
    if (data.goals) applyRemoteGoals(data.goals);
    if (data.plan && typeof data.plan === 'object') {
        const legacy = !(data.planV >= 3) && Array.isArray(data.order) ? new Set(data.order.map(Number)) : new Set();
        const before = JSON.stringify(planMap());
        mergePlan(data.plan, legacy);
        // redraw only when something changed, so a task being edited right now is not interrupted
        if (!opts.quiet && JSON.stringify(planMap()) !== before) renderTasks();
    }
    if (data.timer && isNewer(data.timer, settings)) {
        const newFocus = clamp(data.timer.focus, 1, 180);
        const newBreak = clamp(data.timer.brk, 1, 60);
        const changed = newFocus !== settings.focus || newBreak !== settings.brk;
        settings.focus = newFocus;
        settings.brk = newBreak;
        settings.at = Number(data.timer.at) || 0;
        store.set('settings', settings);
        focusInput.value = settings.focus;
        breakInput.value = settings.brk;
        if (changed && !running && !paused) remaining = duration();
        render();
    }
    if (data.ui && isNewer(data.ui, ui)) {
        ui.theme = THEMES.includes(data.ui.theme) ? data.ui.theme : 'dark';
        ui.bg = BACKGROUNDS.includes(data.ui.bg) ? data.ui.bg : 'solid';
        ui.format = data.ui.format === '12' ? '12' : '24';
        ui.seconds = data.ui.seconds !== false;
        // saves from before Sora still carry the old default clock font: treat that as the new default
        const remoteFont = (data.ui.v !== 2 && data.ui.font === 'mono') ? 'sora' : data.ui.font;
        ui.font = ['sora', 'mono', 'inter', 'dmsans'].includes(remoteFont) ? remoteFont : 'sora';
        if (TEXT_WEIGHTS.includes(Number(data.ui.textWeight))) ui.textWeight = Number(data.ui.textWeight);
        for (const f of Object.keys(FONT_WEIGHTS)) {
            const w = Number(data.ui.weights && data.ui.weights[f]);
            if (FONT_WEIGHTS[f].includes(w)) ui.weights[f] = w;
        }
        if (typeof data.ui.animations === 'boolean') ui.animations = data.ui.animations;
        if (/^#[0-9a-f]{6}$/i.test(data.ui.accent)) ui.accent = data.ui.accent;
        ui.at = Number(data.ui.at) || 0;
        store.set('ui', ui);
        applyUi();
    }
}

// Saving is "read, merge, write", one at a time, and grouped when many changes come at once
let pushTimer = null;
let pushing = null;
let pushAgain = false;

function pushSettings() {
    if (!sb || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushSettings, 400);
}

async function flushSettings() {
    clearTimeout(pushTimer);
    if (!sb || !user) return;
    if (pushing) { pushAgain = true; return pushing; }
    const uid = user.id;
    pending++;
    pushing = (async () => {
        try {
            const { data: s, error } = await sb.from('user_settings').select('data').maybeSingle();
            if (error) throw error;
            if (!user || user.id !== uid) return;
            if (s && s.data) applyRemoteSettings(s.data);
            const { error: e2 } = await sb.from('user_settings').upsert({ user_id: uid, data: settingsPayload() });
            if (e2) throw e2;
            setSync('Synced');
        } catch {
            setSync('Offline. Changes are saved on this device.');
        } finally {
            pending--;
        }
    })();
    await pushing;
    pushing = null;
    if (pushAgain) { pushAgain = false; return flushSettings(); }
}

// ---------- Load from the cloud ----------
async function loadCloud() {
    if (!sb || !user || pending) return;
    const uid = user.id;
    setSync('Syncing…');
    pending++;
    try {
        // First, what this device could not send before
        if (dirtyDel.size) {
            const ids = [...dirtyDel];
            const { error } = await sb.from('tasks').delete().in('id', ids);
            if (!error) { ids.forEach((id) => dirtyDel.delete(id)); saveDirty(); }
        }
        const { data: remote, error } = await sb.from('tasks').select('*').order('id');
        if (error) throw error;
        if (!user || user.id !== uid) return;

        const remoteIds = new Set(remote.map((r) => Number(r.id)));
        // First sign-in on this device: keep the tasks made before signing in. Later: the unsent ones.
        const firstTime = !store.get('synced:' + uid, false);
        const mine = tasks.filter((t) => dirtyUp.has(t.id) || (firstTime && !remoteIds.has(t.id)));
        if (mine.length) {
            const { error: e2 } = await sb.from('tasks').upsert(mine.map(toRow));
            if (e2) throw e2;
            mine.forEach((t) => dirtyUp.delete(t.id));
            saveDirty();
        }
        store.set('synced:' + uid, true);

        // The cloud rows, with this device's version of the ones it just sent, minus pending deletions.
        // Day / time / length are not columns: carry them over from this device, then merge the cloud plan.
        const local = new Map(tasks.map((t) => [t.id, t]));
        const merged = new Map();
        remote.forEach((r) => { if (!dirtyDel.has(Number(r.id))) merged.set(Number(r.id), fromRow(r)); });
        mine.forEach((t) => merged.set(t.id, fromRow(toRow(t))));
        tasks = [...merged.values()].map((t) => {
            const old = local.get(t.id);
            if (old) { setPlanFields(t, [old.date, old.time, old.dur]); t.pAt = old.pAt || 0; }
            return t;
        });

        const { data: s, error: e3 } = await sb.from('user_settings').select('data').maybeSingle();
        if (e3) throw e3;
        if (!user || user.id !== uid) return;
        const data = (s && s.data) || {};
        if (Array.isArray(data.order)) {
            const pos = new Map(data.order.map((id, i) => [Number(id), i]));
            const rank = (t) => (pos.has(t.id) ? pos.get(t.id) : Infinity);
            tasks.sort((a, b) => (rank(a) === rank(b) ? a.id - b.id : rank(a) - rank(b)));
        } else {
            tasks.sort((a, b) => a.id - b.id);
        }
        applyRemoteSettings(data, { quiet: true });
        // Saved by a version from before "To do = today": its tasks without a day were meant for now
        if (!(data.planV >= 2)) giveUndatedToday();
        renderTasks();
        setSync('Synced');
    } catch {
        setSync('Sync failed. Working offline.');
    } finally {
        pending--;
    }
    pushSettings();   // send back the merged result (this device may have had newer changes)
}

// ---------- Tabs of the same browser ----------
// They share this browser's storage: when another tab saves, take its version instead of overwriting it.
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.newValue === null) return;
    switch (e.key) {
        case 'tasks':
            tasks = store.get('tasks', []);
            renderTasks();
            break;
        case 'currentTask':
            currentTaskId = store.get('currentTask', null);
            renderTasks();
            break;
        case 'focus':
            mergeFocus(store.get('focus', {}));
            break;
        case 'sessions':
            mergeSessions(store.get('sessions', []));
            refreshCalendar();
            break;
        case 'goals':
            goals = cleanGoals(store.get('goals', null));
            refreshGoals();
            refreshCalendar();
            break;
        case 'ui':
        case 'settings':
            applyRemoteSettings(e.key === 'ui' ? { ui: store.get('ui', {}) } : { timer: store.get('settings', {}) });
            break;
        case 'dirtyUp':
        case 'dirtyDel':
            (e.key === 'dirtyUp' ? dirtyUp : dirtyDel).clear();
            store.get(e.key, []).forEach((id) => (e.key === 'dirtyUp' ? dirtyUp : dirtyDel).add(id));
            break;
    }
});
