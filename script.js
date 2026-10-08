// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, Math.round(Number(n)) || min));
const today = () => new Date().toDateString();

// ---------- DOM ----------
const focusBtn = $('focus-btn');
const todoBtn = $('todo-btn');
const clockTabBtn = $('clock-btn');
const realtimeEl = $('realtime');
const rtMain = $('rt-main');
const rtSec = $('rt-sec');
const progressEl = $('progress');
const focusContainer = $('focus-container');
const todoContainer = $('todo-container');
const clockEl = $('clock');
const bar = $('progress-bar');
const statusEl = $('status');
const startBtn = $('start-btn');
const pauseBtn = $('pause-btn');
const resetBtn = $('reset-btn');
const focusInput = $('focus-input');
const breakInput = $('break-input');
const presets = document.querySelectorAll('.preset');
const taskInput = $('task-input');
const addBtn = $('add-btn');
const todoList = $('todo-list');

// ---------- Navigation ----------
function showTab(tab) {
    const isClock = tab === 'clock';
    document.body.dataset.tab = tab;
    clockTabBtn.classList.toggle('active', isClock);
    focusBtn.classList.toggle('active', tab === 'focus');
    todoBtn.classList.toggle('active', tab === 'todo');
    // The current-time clock replaces the timer display on its own tab
    realtimeEl.style.display = isClock ? 'block' : 'none';
    clockEl.style.display = isClock ? 'none' : 'block';
    progressEl.style.display = isClock ? 'none' : 'block';
    focusContainer.style.display = tab === 'focus' ? 'block' : 'none';
    todoContainer.style.display = tab === 'todo' ? 'block' : 'none';
}
clockTabBtn.addEventListener('click', () => showTab('clock'));
focusBtn.addEventListener('click', () => showTab('focus'));
todoBtn.addEventListener('click', () => showTab('todo'));

// ---------- Appearance settings ----------
const ui = Object.assign({ theme: 'dark', format: '24', seconds: true, font: 'mono' }, store.get('ui', {}));
const themeSelect = $('theme-select');
const formatSelect = $('format-select');
const secondsSwitch = $('seconds-switch');
const fontSelect = $('font-select');
const rtAmpm = $('rt-ampm');

function applyUi() {
    document.documentElement.dataset.theme = ui.theme;
    document.documentElement.dataset.font = ui.font;
    themeSelect.value = ui.theme;
    formatSelect.value = ui.format;
    secondsSwitch.checked = ui.seconds;
    fontSelect.value = ui.font;
    updateRealtime();
}

function changeUi(key, value) {
    ui[key] = value;
    store.set('ui', ui);
    applyUi();
    pushSettings();
}

themeSelect.addEventListener('change', () => changeUi('theme', themeSelect.value));
formatSelect.addEventListener('change', () => changeUi('format', formatSelect.value));
secondsSwitch.addEventListener('change', () => changeUi('seconds', secondsSwitch.checked));
fontSelect.addEventListener('change', () => changeUi('font', fontSelect.value));

// ---------- Current time ----------
function updateRealtime() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    let h = d.getHours();
    let suffix = '';
    if (ui.format === '12') {
        suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
    }
    rtMain.textContent = `${p(h)}:${p(d.getMinutes())}`;
    rtSec.textContent = ui.seconds ? `:${p(d.getSeconds())}` : '';
    rtAmpm.textContent = suffix;
}
setInterval(updateRealtime, 250);
applyUi();

// ---------- Timer ----------
let settings = store.get('settings', { focus: 25, brk: 5 });
let mode = 'focus';            // 'focus' | 'break'
let running = false;
let paused = false;
let endTime = null;
let tick = null;

const duration = () => (mode === 'focus' ? settings.focus : settings.brk) * 60000;
let remaining = duration();

function format(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function render() {
    const time = format(remaining);
    const label = paused ? 'Paused' : mode === 'focus' ? 'Focus Time' : 'Break Time';
    clockEl.textContent = time;
    bar.style.width = `${Math.max(0, Math.min(100, (remaining / duration()) * 100))}%`;
    statusEl.textContent = label;
    document.title = running ? `${time} · ${label}` : 'Focus';
    document.body.dataset.mode = mode;
    startBtn.disabled = running;
    pauseBtn.disabled = !running;
}

function beep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    } catch {}
}

function startTimer() {
    if (running) return;
    if (remaining <= 0) remaining = duration();
    endTime = Date.now() + remaining;
    running = true;
    paused = false;
    tick = setInterval(update, 250);
    render();
}

function pauseTimer() {
    if (!running) return;
    remaining = endTime - Date.now();
    clearInterval(tick);
    running = false;
    paused = true;
    render();
}

function resetTimer() {
    clearInterval(tick);
    running = false;
    paused = false;
    remaining = duration();
    render();
}

function update() {
    remaining = endTime - Date.now();
    if (remaining > 0) return render();

    beep();
    if (mode === 'focus') {
        // Focus done: break starts automatically
        mode = 'break';
        remaining = duration();
        endTime = Date.now() + remaining;
        render();
    } else {
        // Break done: back to focus, waiting for Start
        mode = 'focus';
        clearInterval(tick);
        running = false;
        paused = false;
        remaining = duration();
        render();
    }
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// ---------- Custom duration ----------
function markPreset() {
    presets.forEach((p) => p.classList.toggle('active', Number(p.dataset.min) === settings.focus));
}

function applySettings() {
    settings.focus = clamp(focusInput.value, 1, 180);
    settings.brk = clamp(breakInput.value, 1, 60);
    focusInput.value = settings.focus;
    breakInput.value = settings.brk;
    store.set('settings', settings);
    pushSettings();
    // If the timer is running, new values apply after the next Reset
    if (!running) {
        paused = false;
        remaining = duration();
    }
    markPreset();
    render();
}

presets.forEach((p) => p.addEventListener('click', () => {
    focusInput.value = p.dataset.min;
    applySettings();
}));
focusInput.addEventListener('change', applySettings);
breakInput.addEventListener('change', applySettings);

// ---------- To do ----------
let tasks = store.get('tasks', []);
let lastDay = today();

function saveTasks() { store.set('tasks', tasks); }

function renderTasks() {
    // Done tasks stay (crossed out) for the rest of the day, then disappear
    const stale = tasks.filter((t) => t.done && t.doneOn !== today());
    if (stale.length) {
        tasks = tasks.filter((t) => !stale.includes(t));
        cloudDelete(stale.map((t) => t.id));
    }
    saveTasks();
    todoList.replaceChildren();

    if (!tasks.length) {
        const li = document.createElement('li');
        li.className = 'todo-empty';
        li.textContent = 'Nothing planned yet.';
        todoList.append(li);
        return;
    }

    tasks.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (t.done ? ' done' : '');
        li.dataset.id = t.id;

        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.done;
        const text = document.createElement('span');
        text.textContent = t.text;
        label.append(cb, text);

        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.textContent = 'Delete';
        del.setAttribute('aria-label', `Delete ${t.text}`);

        li.append(label, del);
        todoList.append(li);
    });
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const task = { id: Date.now(), text, done: false, doneOn: null };
    tasks.push(task);
    taskInput.value = '';
    renderTasks();
    cloudUpsert(task);
}

todoList.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const id = Number(e.target.closest('li').dataset.id);
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = e.target.checked;
    t.doneOn = t.done ? today() : null;
    renderTasks();
    cloudUpsert(t);
});

todoList.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-btn')) return;
    const id = Number(e.target.closest('li').dataset.id);
    tasks = tasks.filter((x) => x.id !== id);
    renderTasks();
    cloudDelete([id]);
});

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
});

// New day (e.g. page left open past midnight): clear yesterday's done tasks
setInterval(() => {
    if (today() !== lastDay) {
        lastDay = today();
        renderTasks();
    }
}, 60000);

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
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPanel.classList.contains('open')) setPanel(false);
});

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
    if (sb && user) track(sb.from('user_settings').upsert({ user_id: user.id, data: { timer: settings, ui } }));
}

function applyRemoteSettings(data) {
    if (data.timer) {
        settings.focus = clamp(data.timer.focus, 1, 180);
        settings.brk = clamp(data.timer.brk, 1, 60);
        store.set('settings', settings);
        focusInput.value = settings.focus;
        breakInput.value = settings.brk;
        if (!running) { paused = false; remaining = duration(); }
        markPreset();
        render();
    }
    if (data.ui) {
        ui.theme = data.ui.theme === 'light' ? 'light' : 'dark';
        ui.format = data.ui.format === '12' ? '12' : '24';
        ui.seconds = data.ui.seconds !== false;
        ui.font = data.ui.font === 'inter' ? 'inter' : 'mono';
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
        renderTasks();

        const { data: s, error: e3 } = await sb.from('user_settings').select('data').maybeSingle();
        if (e3) throw e3;
        if (s && s.data) applyRemoteSettings(s.data);
        else pushSettings();
        setSync('Synced');
    } catch {
        setSync('Sync failed. Working offline.');
    }
}

function updateAccountUi() {
    accountOut.hidden = !!user;
    accountIn.hidden = !user;
    accountEmail.textContent = user ? (user.email || 'Signed in') : '';
}

googleBtn.addEventListener('click', async () => {
    if (!sb) {
        accountNote.textContent = 'Could not load the sign-in service. Check your connection.';
        return;
    }
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) accountNote.textContent = 'Could not start sign-in. Please try again.';
});

signoutBtn.addEventListener('click', async () => {
    if (!sb) return;
    await sb.auth.signOut();
    // Clear this device's copy so the next person who signs in doesn't inherit it
    tasks = [];
    renderTasks();
});

if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
        const next = session ? session.user : null;
        const changed = (next && next.id) !== (user && user.id);
        user = next;
        updateAccountUi();
        if (user && changed) setTimeout(loadCloud, 0);
    });
}

// Refresh from the cloud when coming back to the tab (e.g. after using another device)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && user) loadCloud();
});

updateAccountUi();

// ---------- Init ----------
focusInput.value = settings.focus;
breakInput.value = settings.brk;
markPreset();
render();
renderTasks();
