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
    const isFocus = tab === 'focus';
    focusBtn.classList.toggle('active', isFocus);
    todoBtn.classList.toggle('active', !isFocus);
    focusContainer.style.display = isFocus ? 'block' : 'none';
    todoContainer.style.display = isFocus ? 'none' : 'block';
}
focusBtn.addEventListener('click', () => showTab('focus'));
todoBtn.addEventListener('click', () => showTab('todo'));

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
    tasks = tasks.filter((t) => !t.done || t.doneOn === today());
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
    tasks.push({ id: Date.now(), text, done: false, doneOn: null });
    taskInput.value = '';
    renderTasks();
}

todoList.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const id = Number(e.target.closest('li').dataset.id);
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = e.target.checked;
    t.doneOn = t.done ? today() : null;
    renderTasks();
});

todoList.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-btn')) return;
    const id = Number(e.target.closest('li').dataset.id);
    tasks = tasks.filter((x) => x.id !== id);
    renderTasks();
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

// ---------- Init ----------
focusInput.value = settings.focus;
breakInput.value = settings.brk;
markPreset();
render();
renderTasks();
