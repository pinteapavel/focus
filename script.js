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
const statsBtn = $('stats-btn');
const statsContainer = $('stats-container');
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
const skipBtn = $('skip-btn');
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
    statsBtn.classList.toggle('active', tab === 'stats');
    // The timer display is shown on Focus and To do; Clock and Stats have their own content
    const showTimer = tab === 'focus' || tab === 'todo';
    realtimeEl.style.display = isClock ? 'block' : 'none';
    clockEl.style.display = showTimer ? 'block' : 'none';
    progressEl.style.display = showTimer ? 'block' : 'none';
    statsContainer.style.display = tab === 'stats' ? 'block' : 'none';
    if (tab === 'stats') {
        renderStats();
        mapTip.hidden = true;
        mapWrap.scrollLeft = mapWrap.scrollWidth; // narrow screens: start at the latest weeks
    }
    focusContainer.style.display = tab === 'focus' ? 'block' : 'none';
    todoContainer.style.display = tab === 'todo' ? 'block' : 'none';
}
clockTabBtn.addEventListener('click', () => showTab('clock'));
focusBtn.addEventListener('click', () => showTab('focus'));
todoBtn.addEventListener('click', () => showTab('todo'));
statsBtn.addEventListener('click', () => showTab('stats'));

// ---------- Appearance settings ----------
const DEFAULT_ACCENT = '#5b21b6';
const ui = Object.assign({ theme: 'dark', format: '24', seconds: true, font: 'mono', accent: DEFAULT_ACCENT }, store.get('ui', {}));
if (!/^#[0-9a-f]{6}$/i.test(ui.accent)) ui.accent = DEFAULT_ACCENT;
const themeSelect = $('theme-select');
const formatSelect = $('format-select');
const secondsSwitch = $('seconds-switch');
const fontSelect = $('font-select');
const rtAmpm = $('rt-ampm');
const swatchBtns = document.querySelectorAll('.swatch[data-color]');
const customSwatch = $('swatch-custom');
const accentCustom = $('accent-custom');

// 5 even steps from white (0h) to the accent color (4h+)
function paletteFor(hex) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return [0, 1, 2, 3, 4].map((k) =>
        '#' + rgb.map((c) => Math.round(255 - (255 - c) * (k / 4)).toString(16).padStart(2, '0')).join(''));
}

function applyUi() {
    document.documentElement.dataset.theme = ui.theme;
    document.documentElement.dataset.font = ui.font;
    themeSelect.value = ui.theme;
    formatSelect.value = ui.format;
    secondsSwitch.checked = ui.seconds;
    fontSelect.value = ui.font;
    paletteFor(ui.accent).forEach((c, i) => document.documentElement.style.setProperty(`--p${i}`, c));
    let isPreset = false;
    swatchBtns.forEach((b) => {
        const on = b.dataset.color.toLowerCase() === ui.accent.toLowerCase();
        b.classList.toggle('active', on);
        if (on) isPreset = true;
    });
    customSwatch.classList.toggle('active', !isPreset);
    customSwatch.classList.toggle('has-color', !isPreset);
    customSwatch.style.setProperty('--c', ui.accent);
    accentCustom.value = ui.accent;
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
swatchBtns.forEach((b) => b.addEventListener('click', () => changeUi('accent', b.dataset.color)));
accentCustom.addEventListener('input', () => { ui.accent = accentCustom.value; applyUi(); }); // live preview
accentCustom.addEventListener('change', () => changeUi('accent', accentCustom.value));

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
    document.title = running ? `${time} · ${label}` : 'Clockus';
    document.body.dataset.mode = mode;
    startBtn.disabled = running;
    pauseBtn.disabled = !running;
    skipBtn.hidden = mode !== 'break';
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
    lastTickAt = Date.now();
    running = true;
    paused = false;
    tick = setInterval(update, 250);
    saveTimer();
    render();
}

function pauseTimer() {
    if (!running) return;
    accrueFocus();
    remaining = endTime - Date.now();
    clearInterval(tick);
    running = false;
    paused = true;
    saveTimer();
    render();
    pushSettings();
}

function resetTimer() {
    accrueFocus();
    clearInterval(tick);
    running = false;
    paused = false;
    remaining = duration();
    saveTimer();
    render();
    pushSettings();
}

function update() {
    accrueFocus();
    remaining = endTime - Date.now();
    if (remaining > 0) return render();

    beep();
    if (mode === 'focus') {
        // Focus done: break starts automatically
        mode = 'break';
        pushSettings();
        remaining = duration();
        endTime = Date.now() + remaining;
        saveTimer();
        render();
    } else {
        // Break done: back to focus, waiting for Start
        mode = 'focus';
        clearInterval(tick);
        running = false;
        paused = false;
        remaining = duration();
        saveTimer();
        render();
    }
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Ends the break right away; focus is ready and waits for Start (like a break that ends on its own)
function skipBreak() {
    if (mode !== 'break') return;
    clearInterval(tick);
    running = false;
    paused = false;
    mode = 'focus';
    remaining = duration();
    saveTimer();
    render();
}
skipBtn.addEventListener('click', skipBreak);

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

function pruneFocus() {
    const cutoff = dayKey(new Date(Date.now() - 400 * 86400000));
    for (const days of Object.values(focusLog)) {
        for (const day of Object.keys(days)) if (day < cutoff) delete days[day];
    }
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

// ---------- Stats dashboard ----------
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rangeBtns = document.querySelectorAll('.range-btn');
let statsRange = 'week';
let statsTimer = null;

// n days before today, at noon (avoids daylight-saving edge cases)
function dateAgo(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

function totalsByDay() {
    const totals = {};
    for (const days of Object.values(focusLog)) {
        for (const [day, ms] of Object.entries(days)) totals[day] = (totals[day] || 0) + ms;
    }
    return totals;
}

function shortDuration(ms) {
    const total = Math.floor(ms / 60000);
    if (!total) return '0';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? (m ? `${h}h${pad2(m)}` : `${h}h`) : `${m}m`;
}

function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function renderStatsSoon() {
    if (statsTimer) return;
    statsTimer = setTimeout(() => { statsTimer = null; renderStats(); }, 1000);
}

const HOUR_MS = 3600000;

// Streak = consecutive days with 1h+ of focus. If today has not reached 1h yet,
// the streak is still alive and counts back from yesterday ("at risk" until midnight).
function renderStreak(ms) {
    const todayCounted = ms(dateAgo(0)) >= HOUR_MS;
    const startOffset = todayCounted ? 0 : 1;
    let n = 0;
    while (n < 400 && ms(dateAgo(startOffset + n)) >= HOUR_MS) n++;

    let best = 0;
    let run = 0;
    for (let i = 400; i >= 0; i--) {
        if (ms(dateAgo(i)) >= HOUR_MS) { run++; best = Math.max(best, run); } else run = 0;
    }
    const savedBest = store.get('bestStreak', 0);
    best = Math.max(best, savedBest, n);
    if (best > savedBest) store.set('bestStreak', best);

    const state = n > 0 ? (todayCounted ? 'lit' : 'risk') : 'out';
    $('streak-n').textContent = n;
    $('streak-unit').textContent = n === 1 ? ' day' : ' days';
    $('streak-best').textContent = `Best: ${best} ${best === 1 ? 'day' : 'days'}`;
    $('streak-note').textContent = state === 'lit' ? 'Today counted'
        : state === 'risk' ? 'Focus 1h today to keep it'
        : best > 0 ? 'Streak ended. Start a new one' : 'Focus 1h to start a streak';
    $('streak-flame').setAttribute('class', `flame ${state === 'lit' ? '' : state}`.trim());
    $('streak-card').classList.toggle('out', state === 'out');

    // This week, Monday first: filled = counted, ring = today
    const offset = (dateAgo(0).getDay() + 6) % 7;
    const dots = $('streak-dots');
    dots.replaceChildren();
    'MTWTFSS'.split('').forEach((letter, i) => {
        const d = dateAgo(offset - i);
        const day = makeEl('div', 'streak-day');
        day.append(makeEl('span', 'streak-dot' + (ms(d) >= HOUR_MS ? ' on' : '') + (i === offset ? ' today' : '')));
        day.append(document.createTextNode(letter));
        dots.append(day);
    });

    // day -> position inside the current streak (1 = first day), for the map
    const map = {};
    for (let k = 0; k < n; k++) map[dayKey(dateAgo(startOffset + k))] = n - k;
    return map;
}

function renderStats() {
    const totals = totalsByDay();
    const ms = (d) => totals[dayKey(d)] || 0;
    const now = dateAgo(0);
    const month = statsRange === 'month';

    // Cards
    const today = ms(now);
    const diff = today - ms(dateAgo(1));
    $('sc-today').textContent = fmtDuration(today);
    $('sc-today-sub').textContent = !today && !ms(dateAgo(1)) ? 'No focus yet'
        : Math.abs(diff) < 60000 ? 'Same as yesterday'
        : `${diff > 0 ? '+' : '-'}${fmtDuration(Math.abs(diff))} vs yesterday`;

    const elapsed = month ? now.getDate() : ((now.getDay() + 6) % 7) + 1;
    const periodDays = [];
    let sum = 0;
    for (let i = 0; i < elapsed; i++) {
        const d = dateAgo(i);
        periodDays.push(d);
        sum += ms(d);
    }
    $('sc-period-label').textContent = month ? 'This month' : 'This week';
    $('sc-period').textContent = fmtDuration(sum);
    $('sc-period-sub').textContent = `avg ${fmtDuration(sum / elapsed)} / day`;
    const streakMap = renderStreak(ms);

    // Chart: last 7 or 30 days
    const span = month ? 30 : 7;
    const bars = [];
    for (let i = span - 1; i >= 0; i--) {
        const d = dateAgo(i);
        bars.push({ d, v: ms(d), today: i === 0 });
    }
    const maxV = Math.max(...bars.map((b) => b.v), 3600000);
    const chart = $('chart');
    chart.replaceChildren();
    chart.classList.toggle('month', month);
    bars.forEach((b, idx) => {
        const col = makeEl('div', 'chart-col' + (b.today ? ' today' : ''));
        col.append(makeEl('span', 'chart-val', shortDuration(b.v)));
        const bar = makeEl('div', 'chart-bar');
        bar.style.height = Math.max(3, Math.round((b.v / maxV) * 110)) + 'px';
        col.append(bar);
        const label = month ? (idx % 5 === 4 ? String(b.d.getDate()) : '') : DAY_NAMES[b.d.getDay()];
        col.append(makeEl('span', 'chart-lbl', label));
        chart.append(col);
    });
    $('chart-title').textContent = month ? 'Last 30 days' : 'Last 7 days';
    const best = bars.reduce((a, b) => (b.v > a.v ? b : a), bars[0]);
    const bestDay = month ? `${best.d.getDate()} ${MONTH_NAMES[best.d.getMonth()]}` : DAY_NAMES[best.d.getDay()];
    $('chart-best').textContent = best.v >= 60000 ? `Best: ${bestDay} ${fmtDuration(best.v)}` : '';

    renderMap(totals, now, streakMap);

    // Day by day (newest first; the month view hides empty days)
    const rows = periodDays.filter((d, i) => !month || i === 0 || ms(d) > 0);
    const listMax = Math.max(...rows.map(ms), 3600000);
    const list = $('day-list');
    list.replaceChildren();
    rows.forEach((d) => {
        const isToday = dayKey(d) === dayKey(now);
        const li = makeEl('li', 'day-row' + (isToday ? ' today' : ''));
        li.append(makeEl('span', 'day-name',
            `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${isToday ? ' · today' : ''}`));
        const track = makeEl('div', 'day-track');
        const fill = makeEl('div', 'day-fill');
        fill.style.width = `${(ms(d) / listMax) * 100}%`;
        track.append(fill);
        li.append(track);
        li.append(makeEl('span', 'day-time', ms(d) ? fmtDuration(ms(d)) : '–'));
        list.append(li);
    });
}

// ---- Focus map: one square per day, 52 weeks + this week, Monday first ----
const mapGrid = $('map-grid');
const mapMonths = $('map-months');
const mapWrap = $('map-wrap');
const mapTip = $('map-tip');

function renderMap(totals, now, streakMap) {
    const offset = (now.getDay() + 6) % 7;      // days since Monday
    const count = 364 + offset + 1;
    if (mapGrid.children.length !== count) {    // build once, then only update colors
        mapGrid.replaceChildren();
        for (let i = 0; i < count; i++) mapGrid.append(makeEl('i', 'map-cell l0'));
        const labels = [];
        let prev = -1;
        for (let c = 0; c < 53; c++) {
            const monday = dateAgo(offset + 364 - c * 7);
            if (monday.getMonth() !== prev) {
                prev = monday.getMonth();
                labels.push({ c, name: MONTH_NAMES[prev] });
            }
        }
        if (labels.length > 1 && labels[1].c - labels[0].c < 3) labels.shift(); // avoid overlap
        mapMonths.replaceChildren();
        labels.forEach(({ c, name }) => {
            const s = makeEl('span', '', name);
            s.style.left = `${c * 13}px`;
            mapMonths.append(s);
        });
    }
    let total = 0;
    [...mapGrid.children].forEach((cell, i) => {
        const d = dateAgo(offset + 364 - i);
        const ms = totals[dayKey(d)] || 0;
        total += ms;
        const streakDay = streakMap[dayKey(d)];
        cell.className = `map-cell l${Math.min(4, Math.floor(ms / 3600000))}` + (streakDay ? ' s' : '');
        cell.dataset.ms = ms;
        cell.dataset.streak = streakDay || '';
        cell.dataset.label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
            + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '');
    });
    $('map-total').textContent =
        `${total >= 3600000 ? Math.floor(total / 3600000) + 'h' : fmtDuration(total)} in the last 12 months`;
}

function showTip(cell) {
    const ms = Number(cell.dataset.ms);
    mapTip.textContent = `${cell.dataset.label} · ${ms ? fmtDuration(ms) : 'No focus'}`
        + (cell.dataset.streak ? ` · streak day ${cell.dataset.streak}` : '');
    mapTip.hidden = false;
    const box = mapTip.parentElement.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const tw = mapTip.offsetWidth;
    const th = mapTip.offsetHeight;
    const center = c.left - box.left + c.width / 2;
    const left = Math.max(0, Math.min(box.width - tw, center - tw / 2));
    mapTip.style.left = `${left}px`;
    mapTip.style.top = `${c.top - box.top - th - 8}px`;
    mapTip.style.setProperty('--arrow', `${Math.max(8, Math.min(tw - 8, center - left))}px`);
}

mapGrid.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.map-cell');
    if (cell) showTip(cell);
});
mapGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.map-cell');
    if (cell) showTip(cell);
});
mapGrid.addEventListener('mouseleave', () => { mapTip.hidden = true; });
mapWrap.addEventListener('scroll', () => { mapTip.hidden = true; });
document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.map-cell')) mapTip.hidden = true;
});

rangeBtns.forEach((b) => b.addEventListener('click', () => {
    statsRange = b.dataset.range;
    rangeBtns.forEach((x) => x.classList.toggle('active', x === b));
    renderStats();
}));

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
    tasks = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
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

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '\u283F';
        handle.title = 'Drag to reorder';
        handle.setAttribute('aria-hidden', 'true');

        const edit = document.createElement('button');
        edit.className = 'edit-btn';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', `Edit ${t.text}`);

        li.append(handle, label, edit, del);
        todoList.append(li);
    });
}

function startEdit(li, t) {
    const label = li.querySelector('label');
    if (!label) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.maxLength = 120;
    input.value = t.text;
    input.setAttribute('aria-label', 'Edit task');
    label.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save) => {
        if (finished) return;
        finished = true;
        const value = input.value.trim();
        if (save && value && value !== t.text) {
            t.text = value;
            renderTasks();
            cloudUpsert(t);
        } else {
            renderTasks();
        }
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
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
    if (t.done) {
        // Completed: goes to the very bottom of the list
        tasks = tasks.filter((x) => x !== t);
        tasks.push(t);
    }
    renderTasks();
    cloudUpsert(t);
    pushSettings();
});

todoList.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const li = e.target.closest('li');
        const t = tasks.find((x) => x.id === Number(li.dataset.id));
        if (t) startEdit(li, t);
        return;
    }
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

// ---------- Keyboard shortcuts ----------
let swallowSpaceUp = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (settingsPanel.classList.contains('open')) setPanel(false);
        else if (document.activeElement === taskInput) taskInput.blur();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    if (settingsPanel.classList.contains('open')) return;

    const key = e.key.toLowerCase();
    const onTimerTab = ['focus', 'todo'].includes(document.body.dataset.tab);

    if (e.key === ' ' && onTimerTab) {
        e.preventDefault();
        if (tag === 'BUTTON') swallowSpaceUp = true;
        if (running) pauseTimer();
        else startTimer();
    } else if (key === 'r' && onTimerTab) {
        resetTimer();
    } else if (key === 'n') {
        e.preventDefault();
        showTab('todo');
        taskInput.focus();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && swallowSpaceUp) {
        e.preventDefault();
        swallowSpaceUp = false;
    }
});

// ---------- Reorder tasks (drag & drop) ----------
let drag = null;
let suppressClick = false;

todoList.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('.todo-item');
    if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const onHandle = e.target.closest('.drag-handle');
    const mouseGrab = e.pointerType === 'mouse' && !e.target.closest('input, button');
    if (!onHandle && !mouseGrab) return;
    drag = { li, id: Number(li.dataset.id), startY: e.clientY, active: false, index: 0 };
});

document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
        if (Math.abs(dy) < 6) return;
        drag.active = true;
        drag.li.classList.add('dragging');
        todoList.classList.add('is-dragging');
    }
    e.preventDefault();
    drag.li.style.transform = `translateY(${dy}px)`;

    const others = [...todoList.querySelectorAll('.todo-item')].filter((x) => x !== drag.li);
    let idx = others.findIndex((x) => {
        const r = x.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
    });
    if (idx === -1) idx = others.length;
    drag.index = idx;
    others.forEach((x, i) => {
        x.classList.toggle('drop-before', i === idx);
        x.classList.toggle('drop-after', idx === others.length && i === others.length - 1);
    });
});

function endDrag(cancel) {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.li.classList.remove('dragging');
    d.li.style.transform = '';
    todoList.classList.remove('is-dragging');
    todoList.querySelectorAll('.drop-before, .drop-after')
        .forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (!d.active) return;

    // The click that follows a drag must not toggle the task
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancel) return;

    const from = tasks.findIndex((t) => t.id === d.id);
    if (from < 0) return;
    const [moved] = tasks.splice(from, 1);
    tasks.splice(d.index, 0, moved);
    renderTasks();
    pushSettings();
}

document.addEventListener('pointerup', () => endDrag(false));
document.addEventListener('pointercancel', () => endDrag(true));
todoList.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
}, true);

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
        markPreset();
        render();
    }
    if (data.ui) {
        ui.theme = data.ui.theme === 'light' ? 'light' : 'dark';
        ui.format = data.ui.format === '12' ? '12' : '24';
        ui.seconds = data.ui.seconds !== false;
        ui.font = data.ui.font === 'inter' ? 'inter' : 'mono';
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
restoreTimer();
render();
renderTasks();
updateStats();
showTab('clock'); // the app opens on the Clock tab
