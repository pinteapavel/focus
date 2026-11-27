// Clockus — aesthetic mode (key A): a full-screen animated background; the timer becomes the widget at the bottom left
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// Uses ringPath() from reminders.js and setClean() from clean-mode.js, so it loads after both.

// ---------- Settings (this device only) ----------
const AES_SCENES = ['autumn', 'winter', 'cherry-grove', 'rainy-garden', 'samurai', 'lofi-coffee'];
// Backgrounds that are a looping video; the picture is the poster and the still image when Animations is off
const AES_VIDEOS = {
    autumn: { src: 'backgrounds/autumn.mp4', poster: 'backgrounds/autumn.jpg' },
    winter: { src: 'backgrounds/winter.mp4', poster: 'backgrounds/winter.jpg' },
    'cherry-grove': { src: 'backgrounds/cherry-grove.mp4', poster: 'backgrounds/cherry-grove.jpg' },
    'rainy-garden': { src: 'backgrounds/rainy-garden.mp4', poster: 'backgrounds/rainy-garden.jpg' },
    samurai: { src: 'backgrounds/samurai.mp4', poster: 'backgrounds/samurai.jpg' },
    'lofi-coffee': { src: 'backgrounds/lofi-coffee.mp4', poster: 'backgrounds/lofi-coffee.jpg' }
};
// Christmas Specials (Settings › Appearance, under Animated background), in this order. Their videos are not on the
// site yet: a card stays disabled until its name is in AES_XMAS_READY. To add one, put backgrounds/<name>.mp4 and
// backgrounds/<name>.jpg in site/ (compressed like the others), then add the name below. Nothing else to change.
const AES_XMAS = ['christmas', 'minecraft-fireplace', 'adventure-time', 'forest-snowfall', 'winter-evening', 'northern-landscape'];
const AES_XMAS_READY = ['christmas', 'minecraft-fireplace', 'adventure-time', 'forest-snowfall', 'winter-evening', 'northern-landscape'];
AES_XMAS_READY.filter((k) => AES_XMAS.includes(k)).forEach((k) => {
    AES_SCENES.push(k);
    AES_VIDEOS[k] = { src: `backgrounds/${k}.mp4`, poster: `backgrounds/${k}.jpg` };
});
// The still picture of a Christmas background comes from its .jpg (the first five have theirs in app.css)
function aesPicture(el, scene) {
    el.style.background = AES_XMAS.includes(scene) && AES_VIDEOS[scene]
        ? `#05050a url("${AES_VIDEOS[scene].poster}") center / cover no-repeat` : '';
}
const AES_DEFAULTS = { scene: 'autumn', minimise: true, dim: 40 };

function cleanAesthetic(a) {
    const x = Object.assign({}, AES_DEFAULTS, a && typeof a === 'object' ? a : {});
    if (!AES_SCENES.includes(x.scene)) x.scene = AES_DEFAULTS.scene;
    x.minimise = x.minimise !== false;
    x.dim = Math.round(clamp(x.dim, 0, 100) / 5) * 5;
    return x;
}

let aesthetic = cleanAesthetic(store.get('aesthetic', null));

const aesEl = $('aes');
const aesBg = $('aes-bg');
const aesVideo = $('aes-video');
const aesDimLayer = $('aes-dim-layer');
const aesWidget = $('aes-widget');
const aesPlay = $('aes-play');
const aesExit = $('aes-exit');
const aesSkip = $('aes-skip');
const aesLabel = $('aes-label-text');
const aesTime = $('aes-time');
const aesMiniTime = $('aes-mini-time');
const aesMiniFill = $('aes-mini-fill');
const aesRing = aesWidget.querySelector('.aes-ring');
const aesRingBase = aesWidget.querySelector('.aes-ring-base');
const aesRingFill = aesWidget.querySelector('.aes-ring-fill');
const aesPill = $('aes-pill');
const cleanPill = $('clean-pill');
const aesMinSwitch = $('aes-min-switch');
const aesDimRange = $('aes-dim');

let aesOpen = false;
let aesTick = null;
let aesIdle = null;
let aesSize = '';
let aesLen = 0;

function applyAestheticLook() {
    aesBg.dataset.scene = aesthetic.scene;
    aesPicture(aesBg, aesthetic.scene);
    setAesDim(aesthetic.dim);
}

// The Dim layer over the video; glass.css reads --aes-dim to make the glass as dark as the text needs
function setAesDim(dim) {
    const d = (dim / 100) * 0.8;
    aesDimLayer.style.opacity = String(d);
    document.documentElement.style.setProperty('--aes-dim', String(d));
}

function renderAestheticSettings() {
    aesMinSwitch.checked = aesthetic.minimise;
    setRange(aesDimRange, aesthetic.dim, 100);
    aesDimRange.setAttribute('aria-valuetext', `${aesthetic.dim}%`);
    applyAestheticLook();
    if (typeof syncThemeBg === 'function') syncThemeBg();   // the Animated theme uses the same background
}

function changeAesthetic(key, value) {
    aesthetic[key] = value;
    aesthetic = cleanAesthetic(aesthetic);
    store.set('aesthetic', aesthetic);
    renderAestheticSettings();
}

aesMinSwitch.addEventListener('change', () => {
    changeAesthetic('minimise', aesMinSwitch.checked);
    wakeAesthetic();
});
aesDimRange.addEventListener('input', () => {
    aesDimRange.style.setProperty('--pct', `${aesDimRange.value}%`);
    setAesDim(Number(aesDimRange.value));   // live preview
});
aesDimRange.addEventListener('change', () => changeAesthetic('dim', Number(aesDimRange.value)));

// ---------- The widget ----------
// The border is the same kind of ring as the reminder card: it fills in the accent color as the session goes by
function sizeAesRing() {
    const w = aesWidget.offsetWidth;
    const h = aesWidget.offsetHeight;
    const key = `${w}x${h}`;
    if (!w || !h || key === aesSize) return;
    aesSize = key;
    const d = ringPath(w, h, 31);
    aesRing.setAttribute('viewBox', `0 0 ${w} ${h}`);
    aesRingBase.setAttribute('d', d);
    aesRingFill.setAttribute('d', d);
    aesLen = aesRingFill.getTotalLength();
    aesRingFill.style.strokeDasharray = `${aesLen} ${aesLen}`;
}

function renderAesthetic() {
    if (!aesOpen) return;
    const done = Math.max(0, Math.min(1, 1 - remaining / duration()));
    const time = format(remaining);
    setDigits(aesTime, time);       // only the changed digit moves: digit-motion.js
    setDigits(aesMiniTime, time);

    const task = tasks.find((x) => x.id === currentTaskId && !x.done);
    aesLabel.textContent = paused ? 'Paused' : mode === 'break' ? 'Break' : task ? `Focus · ${task.text}` : 'Focus';
    aesWidget.dataset.state = paused ? 'paused' : mode === 'break' ? 'break' : running ? 'running' : 'idle';
    aesWidget.classList.toggle('playing', running);
    const playLabel = running ? 'Pause (Space)' : 'Start (Space)';
    aesPlay.setAttribute('aria-label', playLabel);
    aesPlay.title = playLabel;

    // Time is up: "Session 2 complete · Take 5 minutes" for a moment (timer-alerts.js decides how long)
    const ended = typeof timerEnd !== 'undefined' && timerEnd;
    aesWidget.classList.toggle('ended', !!ended);
    if (!ended && typeof goalFxWidgetLabel === 'function' && goalFxWidgetLabel()) aesLabel.textContent = 'Goal reached ✓';   // goal-reached.js
    if (ended) {
        aesLabel.textContent = ended.label;
        aesTime.textContent = ended.text;
    }
    aesSkip.hidden = !(ended && ended.kind === 'focus' && mode === 'break');
    aesExit.hidden = !aesSkip.hidden;

    sizeAesRing();
    aesRingFill.style.strokeDashoffset = String(ended ? 0 : aesLen * (1 - done));
    aesMiniFill.style.strokeDashoffset = String(100 * (1 - done));

    // The background stands still when Animations is off or the tab is hidden
    aesBg.classList.toggle('still', !ui.animations || document.hidden);
    syncAesVideo();
}

// A video background loads only when it is shown, plays muted in a loop, and stops when the tab is hidden.
// With Animations off it is not shown at all: the picture behind it (CSS) is the still image.
function syncAesVideo() {
    const video = aesOpen ? AES_VIDEOS[aesthetic.scene] : null;
    const play = !!video && ui.animations && !document.hidden;
    if (play && aesVideo.getAttribute('src') !== video.src) {
        aesVideo.poster = video.poster;
        aesVideo.src = video.src;
    }
    aesVideo.hidden = !video || !ui.animations;
    if (play && aesVideo.paused) {
        aesVideo.muted = true;
        const p = aesVideo.play();
        if (p && p.catch) p.catch(() => {});
    } else if (!play && !aesVideo.paused) {
        aesVideo.pause();
    }
    if (typeof syncAmbient === 'function') syncAmbient();   // the ambient sound follows (ambient-sound.js)
}

// After 5 s without the mouse or a key, the widget shrinks to ring and time
function wakeAesthetic() {
    if (!aesOpen) return;
    clearTimeout(aesIdle);
    if (aesWidget.classList.contains('min')) {
        aesWidget.classList.remove('min');
        renderAesthetic();
    }
    if (aesthetic.minimise) aesIdle = setTimeout(() => aesWidget.classList.add('min'), 5000);
}
['pointermove', 'pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, wakeAesthetic));
aesWidget.addEventListener('transitionend', (e) => { if (e.target === aesWidget) renderAesthetic(); });
document.addEventListener('visibilitychange', renderAesthetic);

function setAesthetic(on) {
    if (on && document.body.dataset.tab !== 'focus') return;
    if (on && ui.theme !== 'animated') return;   // only with the Animated theme (its button is hidden otherwise)
    if (on === aesOpen) return;
    aesOpen = on;
    clearInterval(aesTick);
    clearTimeout(aesIdle);
    aesPill.setAttribute('aria-pressed', String(on));
    aesPill.title = on ? 'Exit aesthetic mode (A)' : 'Aesthetic mode (A)';
    document.body.classList.toggle('aesthetic', on);
    aesEl.getAnimations().forEach((a) => a.cancel());
    if (typeof syncThemeBg === 'function') syncThemeBg();   // the Animated theme's video waits underneath

    if (on) {
        setClean(false);
        if (typeof homeRememberLook === 'function') homeRememberLook(true);   // Home shows the video too (home.js)
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        aesWidget.classList.remove('min');
        aesEl.hidden = false;
        aesSize = '';
        renderAesthetic();
        aesTick = setInterval(renderAesthetic, 250);
        wakeAesthetic();
        if (ui.animations && aesEl.animate) aesEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' });
    } else if (ui.animations && aesEl.animate) {
        syncAesVideo();   // pauses a video background
        const fade = aesEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        fade.onfinish = () => { if (!aesOpen) { aesEl.hidden = true; fade.cancel(); } };
    } else {
        syncAesVideo();
        aesEl.hidden = true;
    }
}

aesPlay.addEventListener('click', () => {
    if (running) pauseTimer();
    else startTimer();
    renderAesthetic();
});
aesExit.addEventListener('click', () => setAesthetic(false));
aesSkip.addEventListener('click', () => {
    skipBreak();
    renderAesthetic();
});
aesPill.addEventListener('click', () => setAesthetic(true));
cleanPill.addEventListener('click', () => setClean(!document.body.classList.contains('clean')));

renderAestheticSettings();
