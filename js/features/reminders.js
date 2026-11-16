// Clockus — top priority reminder: the card at the top left, its short sound, and Settings › Notifications
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// The reminder is shown inside the page, so it only appears while a Clockus tab is open.

// ---------- Settings (this device only) ----------
const REM_EVERY = [30, 60, 120, 180];   // minutes
const REM_SHOW = [5, 8, 12];            // seconds
const REM_DEFAULTS = { on: true, every: 60, wait: true, show: 8, sound: true, volume: 50 };

function cleanReminders(r) {
    const x = Object.assign({}, REM_DEFAULTS, r && typeof r === 'object' ? r : {});
    x.on = x.on !== false;
    x.wait = x.wait !== false;
    x.sound = x.sound !== false;
    x.every = REM_EVERY.includes(Number(x.every)) ? Number(x.every) : REM_DEFAULTS.every;
    x.show = REM_SHOW.includes(Number(x.show)) ? Number(x.show) : REM_DEFAULTS.show;
    x.volume = clamp(x.volume, 0, 100);
    return x;
}

let reminders = cleanReminders(store.get('reminders', null));
// When the reminder was last shown (shared by the tabs of this browser, so only one of them shows it)
let remLast = Number(store.get('reminderLast', 0)) || 0;
if (!remLast) { remLast = Date.now(); store.set('reminderLast', remLast); }

const remSwitch = $('rem-switch');
const remWait = $('rem-wait');
const remSound = $('rem-sound');
const remVolume = $('rem-volume');
const remEveryBtns = document.querySelectorAll('[data-rem-every]');
const remShowBtns = document.querySelectorAll('[data-rem-show]');
const everyLabel = (m) => (m < 60 ? `${m} min` : `${m / 60} h`);

function renderReminderSettings() {
    remSwitch.checked = reminders.on;
    remWait.checked = reminders.wait;
    remSound.checked = reminders.sound;
    press(remEveryBtns, (b) => Number(b.dataset.remEvery) === reminders.every);
    press(remShowBtns, (b) => Number(b.dataset.remShow) === reminders.show);
    setRange(remVolume, reminders.volume, 100);
    remVolume.setAttribute('aria-valuetext', `${reminders.volume}%`);
    document.querySelectorAll('.rem-dep').forEach((row) => row.classList.toggle('off', !reminders.on));
    $('rem-volume-row').classList.toggle('off', !reminders.on || !reminders.sound);
    $('sum-notifications').textContent = reminders.on ? `Every ${everyLabel(reminders.every)}` : 'Off';
}

function changeReminders(key, value) {
    reminders[key] = value;
    reminders = cleanReminders(reminders);
    store.set('reminders', reminders);
    renderReminderSettings();
}

remSwitch.addEventListener('change', () => {
    if (remSwitch.checked) { remLast = Date.now(); store.set('reminderLast', remLast); }   // next one after a full interval
    changeReminders('on', remSwitch.checked);
    if (!reminders.on) hideReminder(true);
});
remWait.addEventListener('change', () => changeReminders('wait', remWait.checked));
remSound.addEventListener('change', () => {
    changeReminders('sound', remSound.checked);
    if (reminders.sound) chime();   // a preview
});
remEveryBtns.forEach((b) => b.addEventListener('click', () => changeReminders('every', Number(b.dataset.remEvery))));
remShowBtns.forEach((b) => b.addEventListener('click', () => changeReminders('show', Number(b.dataset.remShow))));
remVolume.addEventListener('input', () => {
    remVolume.style.setProperty('--pct', `${remVolume.value}%`);
    remVolume.setAttribute('aria-valuetext', `${remVolume.value}%`);
});
remVolume.addEventListener('change', () => {
    changeReminders('volume', Number(remVolume.value));
    chime();   // a preview at the new volume
});

// ---------- Sound: a short, quiet two-note chime made with Web Audio (no files) ----------
// The audio is only started after the first click or key press on the page, as browsers require.
let remAudio = null;
function unlockAudio() {
    if (!remAudio) {
        try { remAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch { remAudio = null; }
    }
    if (remAudio && remAudio.state === 'suspended') remAudio.resume().catch(() => {});
    if (remAudio) ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.removeEventListener(ev, unlockAudio, true));
}
['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, unlockAudio, true));

function chime() {
    if (reminders.sound) playChime(reminders.volume);
}

// The same chime at any volume (0-100); also used when a timer session ends (timer-alerts.js)
function playChime(volume) {
    if (!volume || !remAudio) return;
    try {
        if (remAudio.state === 'suspended') remAudio.resume().catch(() => {});
        const v = volume / 100;
        const peak = 0.12 * v * v;   // gentle even at 100%; the square makes low volumes really low
        const start = remAudio.currentTime + 0.03;
        [[784, 0], [1046.5, 0.13]].forEach(([freq, delay]) => {
            const t = start + delay;
            const osc = remAudio.createOscillator();
            const gain = remAudio.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            osc.connect(gain);
            gain.connect(remAudio.destination);
            osc.start(t);
            osc.stop(t + 0.55);
        });
    } catch {}
}

// ---------- The card at the top left ----------
const prioToast = $('prio-toast');
const prioToastBtn = $('prio-toast-btn');
const prioToastTask = $('prio-toast-task');
const ringBase = prioToast.querySelector('.prio-ring-base');
const ringFill = prioToast.querySelector('.prio-ring-fill');
let toastTimer = null;

const topTask = () => tasks.find((t) => t.id === topPriorityId && !t.done);

// A rounded rectangle that starts at the top left corner and runs clockwise
function ringPath(w, h, r) {
    const i = 0.75;   // half the stroke, so the line sits inside the card
    r = Math.min(r, (w - 2 * i) / 2, (h - 2 * i) / 2);
    return `M ${i} ${r + i} A ${r} ${r} 0 0 1 ${r + i} ${i} H ${w - r - i} A ${r} ${r} 0 0 1 ${w - i} ${r + i}`
        + ` V ${h - r - i} A ${r} ${r} 0 0 1 ${w - r - i} ${h - i} H ${r + i} A ${r} ${r} 0 0 1 ${i} ${h - r - i} Z`;
}

function showReminder() {
    const t = topTask();
    if (!t) return;
    clearTimeout(toastTimer);
    prioToastTask.textContent = t.text;
    prioToastBtn.setAttribute('aria-label', `Top priority: ${t.text}. Open To do`);
    prioToast.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    prioToast.hidden = false;

    const w = prioToastBtn.offsetWidth;
    const h = prioToastBtn.offsetHeight;
    const d = ringPath(w, h, 14);
    prioToast.querySelector('.prio-ring').setAttribute('viewBox', `0 0 ${w} ${h}`);
    ringBase.setAttribute('d', d);
    ringFill.setAttribute('d', d);
    const len = ringFill.getTotalLength();
    ringFill.style.strokeDasharray = `${len} ${len}`;
    ringFill.style.strokeDashoffset = '0';   // full, if animations are not available
    const ms = reminders.show * 1000;
    // The ring fills clockwise from the top left while the card is shown; fades in and out at the ends
    ringFill.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    if (ui.animations) {
        prioToast.animate([
            { opacity: 0, transform: 'translateY(-6px)' },
            { opacity: 1, transform: 'none', offset: Math.min(0.4, 400 / ms) },
            { opacity: 1, transform: 'none' }
        ], { duration: ms, easing: 'ease-out' });
    }
    chime();
    toastTimer = setTimeout(() => hideReminder(false), ms);
}

function hideReminder(now) {
    clearTimeout(toastTimer);
    if (prioToast.hidden) return;
    const close = () => { prioToast.getAnimations({ subtree: true }).forEach((a) => a.cancel()); prioToast.hidden = true; };
    if (now || !ui.animations) { close(); return; }
    prioToast.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-in', fill: 'forwards' });
    toastTimer = setTimeout(close, 400);
}

prioToastBtn.addEventListener('click', () => {
    hideReminder(true);
    showTab('todo');
});

// Called by tasks.js when the flag moves: the next reminder comes after a full interval
function onTopPriorityChange() {
    remLast = Date.now();
    store.set('reminderLast', remLast);
    hideReminder(true);   // a card on screen would show the old task
}

// Due? Only in a visible tab, and (if chosen) not while a focus session is running
setInterval(() => {
    remLast = Number(store.get('reminderLast', remLast)) || remLast;   // another tab may have shown it
    if (!reminders.on || !topTask() || !prioToast.hidden) return;
    if (document.visibilityState !== 'visible') return;
    if (reminders.wait && running && mode === 'focus') return;
    if (Date.now() - remLast < reminders.every * 60000) return;
    remLast = Date.now();
    store.set('reminderLast', remLast);
    showReminder();
}, 5000);

// Other tabs of this browser: same flag, same settings
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage) return;
    if (e.key === 'topPriority') {
        topPriorityId = store.get('topPriority', null);
        renderTasks();
        if (!topTask()) hideReminder(true);
    } else if (e.key === 'reminders') {
        reminders = cleanReminders(store.get('reminders', null));
        renderReminderSettings();
    }
});

renderReminderSettings();
