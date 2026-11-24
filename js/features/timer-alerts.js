// Clockus — timer alerts: the tab title and icon for each timer state, and what happens when a session ends
// (the chime, the flashing title, the end card on the widget, the optional browser notification),
// plus Settings › Timer alerts.
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// Uses playChime() from reminders.js, so it loads after it. The widget (aesthetic-mode.js) reads `timerEnd`.

// ---------- Settings (this device only) ----------
const TA_DEFAULTS = { title: true, sound: true, volume: 60, flash: true, notify: false };

function cleanTimerAlerts(a) {
    const x = Object.assign({}, TA_DEFAULTS, a && typeof a === 'object' ? a : {});
    x.title = x.title !== false;
    x.sound = x.sound !== false;
    x.flash = x.flash !== false;
    x.notify = x.notify === true;
    x.volume = clamp(x.volume, 0, 100);
    return x;
}

let timerAlerts = cleanTimerAlerts(store.get('timerAlerts', null));

const taTitle = $('ta-title');
const taSound = $('ta-sound');
const taVolume = $('ta-volume');
const taFlash = $('ta-flash');
const taNotify = $('ta-notify');
const taNotifyNote = $('ta-notify-note');
const TA_NOTIFY_NOTE = taNotifyNote.textContent;

const canNotify = () => 'Notification' in window;
const notifyOn = () => timerAlerts.notify && canNotify() && Notification.permission === 'granted';

function renderTimerAlertSettings() {
    taTitle.checked = timerAlerts.title;
    taSound.checked = timerAlerts.sound;
    taFlash.checked = timerAlerts.flash;
    taNotify.checked = notifyOn();
    setRange(taVolume, timerAlerts.volume, 100);
    taVolume.setAttribute('aria-valuetext', `${timerAlerts.volume}%`);
    $('ta-volume-row').classList.toggle('off', !timerAlerts.sound);
    if (!canNotify()) {
        taNotify.disabled = true;
        taNotifyNote.textContent = 'Not available in this browser.';
    } else if (Notification.permission === 'denied') {
        taNotifyNote.textContent = 'Blocked in your browser settings.';
    } else {
        taNotifyNote.textContent = TA_NOTIFY_NOTE;
    }
    const on = [timerAlerts.title && 'Title', timerAlerts.sound && 'Sound', notifyOn() && 'Notification'].filter(Boolean);
    $('sum-timer-alerts').textContent = on.length ? on.join(' · ') : 'Off';
}

function changeTimerAlerts(key, value) {
    timerAlerts[key] = value;
    timerAlerts = cleanTimerAlerts(timerAlerts);
    store.set('timerAlerts', timerAlerts);
    renderTimerAlertSettings();
    renderTabTitle();
}

taTitle.addEventListener('change', () => changeTimerAlerts('title', taTitle.checked));
taFlash.addEventListener('change', () => changeTimerAlerts('flash', taFlash.checked));
taSound.addEventListener('change', () => {
    changeTimerAlerts('sound', taSound.checked);
    if (timerAlerts.sound) playChime(timerAlerts.volume);   // a preview
});
taVolume.addEventListener('input', () => {
    taVolume.style.setProperty('--pct', `${taVolume.value}%`);
    taVolume.setAttribute('aria-valuetext', `${taVolume.value}%`);
});
taVolume.addEventListener('change', () => {
    changeTimerAlerts('volume', Number(taVolume.value));
    playChime(timerAlerts.volume);   // a preview at the new volume
});
// The browser asks for permission the first time; if you decline, the switch stays off and the rest still works
taNotify.addEventListener('change', () => {
    if (!taNotify.checked || !canNotify()) { changeTimerAlerts('notify', false); return; }
    if (Notification.permission === 'granted') { changeTimerAlerts('notify', true); return; }
    if (Notification.permission === 'denied') { changeTimerAlerts('notify', false); return; }
    taNotify.checked = false;   // until the browser answers
    const ask = Notification.requestPermission((p) => changeTimerAlerts('notify', p === 'granted'));
    if (ask && ask.then) ask.then((p) => changeTimerAlerts('notify', p === 'granted')).catch(() => changeTimerAlerts('notify', false));
});

// ---------- Tab icon ----------
const iconLinks = [...document.querySelectorAll('link[rel="icon"]')];
const iconDefaults = iconLinks.map((l) => l.getAttribute('href'));
let iconNow = '';

// The browser's tab strip is light or dark (it follows the system). A very light or very dark accent, like the
// text colour of the colour themes (Forest's cream, Vanilla's navy), would vanish on it: keep the accent's hue
// but lighten or darken it step by step until it stands out (contrast 3:1).
const tabStripDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const mixHex = (a, b, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k)
    .toString(16).padStart(2, '0')).join('');
function tabIconColor() {
    const dark = !!(tabStripDark && tabStripDark.matches);
    const strip = dark ? '#202124' : '#dee1e6';
    const toward = dark ? '#ffffff' : '#000000';
    let c = ui.accent;
    for (let k = 0.1; contrast(c, strip) < 3 && k < 1; k += 0.1) c = mixHex(ui.accent, toward, k);
    return c;
}

function iconSvg(kind, frac) {
    const acc = tabIconColor();
    const tick = contrast('#ffffff', acc) >= contrast('#111111', acc) ? '#ffffff' : '#111111';   // the check stays readable on its disc
    const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${body}</svg>`;
    const track = (w, o) => `<circle cx="16" cy="16" r="12" fill="none" stroke="#8a8a8a" stroke-opacity="${o}" stroke-width="${w}"/>`;
    const arc = (w, o) => `<circle cx="16" cy="16" r="12" fill="none" stroke="${acc}" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"`
        + ` pathLength="100" stroke-dasharray="${frac} 100" transform="rotate(-90 16 16)"/>`;
    const check = `<circle cx="16" cy="16" r="14" fill="${acc}"/><path d="M10 16.5l4 4 8-8.5" fill="none" stroke="${tick}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    switch (kind) {
        case 'focus': return svg(track(4, 0.35) + (frac > 0 ? arc(4, 1) : ''));
        // Softer and shorter, so a break does not look like focus
        case 'break': return svg(track(3, 0.25) + (frac > 0 ? arc(3, 0.55) : ''));
        case 'paused': return svg(track(3, 0.6) + '<rect x="11.5" y="10" width="3" height="12" rx="1" fill="#8a8a8a"/><rect x="17.5" y="10" width="3" height="12" rx="1" fill="#8a8a8a"/>');
        case 'done': return svg(check);
        case 'flag': return svg(`<path d="M9 28V5" stroke="${acc}" stroke-width="3" stroke-linecap="round"/><path d="M10 5h14l-3.5 5.5L24 16H10z" fill="${acc}"/>`);
        default: return '';
    }
}

function setTabIcon(kind, frac) {
    const svg = kind ? iconSvg(kind, frac) : '';
    if (svg === iconNow) return;
    iconNow = svg;
    const href = svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : null;
    iconLinks.forEach((l, i) => l.setAttribute('href', href || iconDefaults[i]));
}

// ---------- When a session ends ----------
// The end card on the widget: { kind: 'focus' | 'break', label, text, sig, seenAt }
let timerEnd = null;
let flashing = null;          // 'focus' | 'break' while the title flashes
let goalPending = false;      // the daily goal was reached during the running focus session
let goalShowUntil = 0;
let goalSeen = goalWasReached;
let lastFocusAt = 0;          // the goal line catches up about a second after the session, so allow a few seconds

// Looking at the page: the tab is shown and its window is the active one
const lookingAtPage = () => document.visibilityState === 'visible' && document.hasFocus();
const timerSig = () => `${mode}|${running}|${paused}`;

// Called by timer.js when time is up, before it moves on to the next part ('focus' = focus finished)
function onSessionEnd(finished) {
    if (timerAlerts.sound) playChime(timerAlerts.volume);
    const looking = lookingAtPage();
    flashing = timerAlerts.flash && !looking ? finished : null;

    const brk = settings.brk;
    if (finished === 'focus') {
        const n = Math.max(1, pomodorosOn(dayKey()));
        timerEnd = { kind: 'focus', label: `Session ${n} complete`, text: `Take ${brk} minute${brk === 1 ? '' : 's'}` };
    } else {
        timerEnd = { kind: 'break', label: 'Break over', text: 'Ready to focus' };
    }
    timerEnd.sig = null;      // set right after the timer has moved on
    timerEnd.seenAt = null;
    if (typeof wakeAesthetic === 'function') wakeAesthetic();

    // Skipped on purpose when you are already looking at the page: the ring and the chime are enough
    if (!looking && notifyOn()) {
        try {
            const n = new Notification(finished === 'focus' ? 'Focus session finished' : 'Break finished', {
                body: finished === 'focus' ? `Time for a ${brk} minute break.` : 'Ready for the next focus session?',
                icon: 'icon-192.png',
                tag: 'clockus-timer'
            });
            n.onclick = () => { window.focus(); n.close(); };
        } catch {}
    }
}

// The end card stays until you have looked at it for 10 s, or until the timer is started, paused or skipped
function checkTimerEnd() {
    if (!timerEnd) return;
    if (timerEnd.sig === null) timerEnd.sig = timerSig();
    else if (timerEnd.sig !== timerSig()) timerEnd = null;
    if (!timerEnd) return;
    if (lookingAtPage() && timerEnd.seenAt === null) timerEnd.seenAt = Date.now();
    if (timerEnd.seenAt !== null && Date.now() - timerEnd.seenAt > 10000) timerEnd = null;
}

function stopFlashing() {
    if (!flashing || !lookingAtPage()) return;
    flashing = null;
    renderTabTitle();
}
window.addEventListener('focus', stopFlashing);
document.addEventListener('visibilitychange', stopFlashing);

// "Daily goal reached" for a minute after the session that reaches the goal
function checkGoal() {
    const focusing = running && mode === 'focus';
    if (focusing) lastFocusAt = Date.now();
    if (goalSeen === false && goalWasReached === true && Date.now() - lastFocusAt < 5000) goalPending = true;
    goalSeen = goalWasReached;
    if (goalPending && !focusing) {
        goalPending = false;
        goalShowUntil = Date.now() + 60000;
    }
}

// ---------- Tab title ----------
// Exactly on time: besides the timer's own tick, a single wake-up at the end of the session,
// so a throttled background tab does not end the session late
let endWake = null;
let endWakeFor = null;
function scheduleEndWake() {
    const at = running ? endTime : null;
    if (at === endWakeFor) return;
    endWakeFor = at;
    clearTimeout(endWake);
    if (at) endWake = setTimeout(() => { if (running) update(); }, Math.max(0, at - Date.now()) + 30);
}

const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function renderTabTitle() {
    scheduleEndWake();
    checkTimerEnd();
    checkGoal();
    const time = format(remaining);
    let title = 'Clockus';
    let icon = null;
    let frac = Math.round(Math.max(0, Math.min(1, remaining / duration())) * 100);

    if (flashing) {
        const tick = Math.floor(Date.now() / 1000) % 2;
        title = tick ? 'Back to Clockus' : flashing === 'focus' ? 'Time is up! · Clockus' : 'Break over · Focus?';
        icon = 'done';
    } else if (timerAlerts.title) {
        const reminderTask = !prioToast.hidden && topTask();
        if (reminderTask) {
            title = `Reminder · ${shorten(reminderTask.text, 18)}`;
            icon = 'flag';
        } else if (goals && Date.now() < goalShowUntil) {
            title = `Daily goal reached · ${fmtGoal(goals.focus)}`;
            icon = 'done';
        } else if (running) {
            title = mode === 'focus' ? `${time} · Focus` : `Break · ${time}`;
            icon = mode === 'focus' ? 'focus' : 'break';
        } else if (paused) {
            title = mode === 'focus' ? `Paused · ${time}` : `Break paused · ${time}`;
            icon = 'paused';
        } else if (document.body.dataset.tab === 'clock') {
            title = `${rtMain.textContent}${rtAmpm.textContent ? ' ' + rtAmpm.textContent : ''} · Clockus`;
        }
    }
    if (document.title !== title) document.title = title;
    setTabIcon(icon, frac);
}

setInterval(renderTabTitle, 1000);

// Other tabs of this browser: same settings
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.key !== 'timerAlerts') return;
    timerAlerts = cleanTimerAlerts(store.get('timerAlerts', null));
    renderTimerAlertSettings();
    renderTabTitle();
});

renderTimerAlertSettings();
