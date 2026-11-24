// Clockus — Pomodoro timer and custom focus/break durations
// Loaded as a classic script (shared global scope). Load order is set in app.html.

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

// ---------- Custom duration ----------
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
    render();
}

focusInput.addEventListener('change', applySettings);
breakInput.addEventListener('change', applySettings);
