// Clockus — cloud sync with Supabase: tasks, settings and focus log
// Loaded as a classic script (shared global scope). Load order is set in app.html.

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

function setSync(msg) { syncStatus.textContent = msg; }

async function track(query) {
    pending++;
    try {
        const { error } = await query;
        setSync(error ? 'Sync failed. Changes are saved on this device.' : 'Synced');
    } catch {
        setSync('Offline. Changes are saved on this device.');
    } finally {
        pending--;
    }
}

function cloudUpsert(t) {
    if (sb && user) track(sb.from('tasks').upsert(toRow(t)));
}
function cloudDelete(ids) {
    if (sb && user && ids.length) track(sb.from('tasks').delete().in('id', ids));
}
function pushSettings() {
    if (sb && user) track(sb.from('user_settings').upsert({ user_id: user.id, data: { timer: settings, ui, order: tasks.map((t) => t.id), focus: focusLog } }));
}

function applyRemoteSettings(data) {
    if (data.focus) mergeFocus(data.focus);
    if (data.timer) {
        const newFocus = clamp(data.timer.focus, 1, 180);
        const newBreak = clamp(data.timer.brk, 1, 60);
        const changed = newFocus !== settings.focus || newBreak !== settings.brk;
        settings.focus = newFocus;
        settings.brk = newBreak;
        store.set('settings', settings);
        focusInput.value = settings.focus;
        breakInput.value = settings.brk;
        if (changed && !running && !paused) remaining = duration();
        render();
    }
    if (data.ui) {
        ui.theme = data.ui.theme === 'light' ? 'light' : 'dark';
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
        store.set('ui', ui);
        applyUi();
    }
}

async function loadCloud() {
    if (!sb || !user || pending) return;
    const uid = user.id;
    setSync('Syncing…');
    try {
        const { data: remote, error } = await sb.from('tasks').select('*').order('id');
        if (error) throw error;

        if (!store.get('synced:' + uid, false)) {
            // First sign-in on this device: keep tasks made before signing in
            const have = new Set(remote.map((r) => Number(r.id)));
            const extra = tasks.filter((t) => !have.has(t.id));
            if (extra.length) {
                const { error: e2 } = await sb.from('tasks').upsert(extra.map(toRow));
                if (e2) throw e2;
            }
            tasks = [...remote.map(fromRow), ...extra].sort((a, b) => a.id - b.id);
            store.set('synced:' + uid, true);
        } else {
            tasks = remote.map(fromRow);
        }
        if (!user || user.id !== uid) return;

        const { data: s, error: e3 } = await sb.from('user_settings').select('data').maybeSingle();
        if (e3) throw e3;
        if (s && s.data && Array.isArray(s.data.order)) {
            const pos = new Map(s.data.order.map((id, i) => [Number(id), i]));
            const rank = (t) => (pos.has(t.id) ? pos.get(t.id) : Infinity);
            tasks.sort((a, b) => (rank(a) === rank(b) ? a.id - b.id : rank(a) - rank(b)));
        }
        renderTasks();
        if (s && s.data) applyRemoteSettings(s.data);
        else pushSettings();
        setSync('Synced');
    } catch {
        setSync('Sync failed. Working offline.');
    }
}
