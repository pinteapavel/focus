// Clockus — ambient sound in Aesthetic mode: a quiet loop that matches the background
// Loaded as a classic script (shared global scope), after aesthetic-mode.js. Load order is set in app.html.
//
// - Plays only in Aesthetic mode, never on other tabs. Fades in over 1.5 s, fades out when you leave, pause
//   the timer or hide the tab. Changing the background crossfades the old sound into the new one.
// - Off by default. On/off and the volume live in `ui.ambient`, so they are remembered and synced like the
//   other settings. The Animations setting is about visuals only: it does not mute the sound.
// - The files are sounds/<background>.mp3. If a file is missing, the speaker is hidden for that background.

const AMBIENT_DIR = 'sounds/';
const AMBIENT_FADE = 1500;   // ms
// What each background sounds like: [short name next to the speaker, full name in the small box]
const AMBIENT_NAMES = {
    samurai: ['Wind', 'Wind and distant temple bells'],
    'rainy-garden': ['Rain', 'Rain on leaves'],
    'cherry-grove': ['Breeze', 'Soft breeze and birds'],
    autumn: ['Leaves', 'Rustling leaves'],
    winter: ['Wind', 'Snowy wind'],
    'lofi-coffee': ['Café', 'Quiet café'],
    christmas: ['Chimes', 'Soft chimes'],
    'minecraft-fireplace': ['Fire', 'Crackling fire'],
    'adventure-time': ['Ambient', 'Ambient sound'],
    'forest-snowfall': ['Snow', 'Quiet snowfall in the forest'],
    'winter-evening': ['Evening', 'Quiet winter evening'],
    'northern-landscape': ['Wind', 'Cold mountain wind']
};

function cleanAmbient(a) {
    const x = a && typeof a === 'object' ? a : {};
    return { on: x.on === true, volume: Math.round(clamp(Number(x.volume) || (x.volume === 0 ? 0 : 40), 0, 100) / 5) * 5 };
}
ui.ambient = cleanAmbient(ui.ambient);

const ambSoundBtn = $('aes-sound');
const ambSoundName = $('aes-sound-name');
const ambPop = $('aes-sound-pop');
const ambPopName = $('aes-sound-full');
const ambPopRange = $('aes-sound-vol');
const ambPopPct = $('aes-sound-pct');
const ambSwitch = $('ambient-switch');
const ambRange = $('ambient-volume');
const ambPct = $('ambient-pct');

const ambTracks = {};      // scene → { audio, state: 'unknown' | 'ok' | 'missing', fade }
let ambBlocked = false;     // the browser refused to start the sound until the person presses something

function ambTrack(scene) {
    if (!ambTracks[scene]) {
        const audio = new Audio();
        audio.loop = true;
        audio.preload = 'metadata';
        audio.volume = 0;
        const t = { audio, state: 'unknown', fade: null };
        audio.addEventListener('loadedmetadata', () => { t.state = 'ok'; syncAmbient(); });
        audio.addEventListener('error', () => { t.state = 'missing'; syncAmbient(); });
        audio.src = `${AMBIENT_DIR}${scene}.mp3`;
        ambTracks[scene] = t;
    }
    return ambTracks[scene];
}

// A short volume ramp on a timer (animation frames stop in a hidden tab); at 0 the sound is paused.
// A hidden tab stops the sound at once.
function ambFade(t, to, ms) {
    clearInterval(t.fade);
    const a = t.audio;
    if (to === 0 && document.hidden) { a.volume = 0; a.pause(); return; }
    const from = a.volume;
    if (to > 0 && a.paused) {
        const p = a.play();
        if (p && p.then) {
            p.then(() => { if (ambBlocked) { ambBlocked = false; renderAmbientUi(); } })
                .catch((err) => { if (err && err.name === 'NotAllowedError') { ambBlocked = true; renderAmbientUi(); } });
        }
    }
    const start = Date.now();
    const step = () => {
        const k = ms ? Math.min(1, (Date.now() - start) / ms) : 1;
        a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k < 1) return;
        clearInterval(t.fade);
        if (to === 0) a.pause();
    };
    t.fade = setInterval(step, 40);
    step();
}

// Called whenever Aesthetic mode, the timer, the tab or the background changes (from syncAesVideo)
function syncAmbient() {
    const scene = aesthetic.scene;
    const here = aesOpen ? ambTrack(scene) : null;   // entering Aesthetic mode checks whether the file exists
    const play = !!here && here.state === 'ok' && ui.ambient.on && !paused && !document.hidden;
    const target = ui.ambient.volume / 100;
    for (const [s, t] of Object.entries(ambTracks)) {
        const want = play && s === scene ? target : 0;
        const goingUp = want > 0 && (t.audio.paused || t.wanted !== want);
        const goingDown = want === 0 && !t.audio.paused && t.wanted !== 0;
        if (goingUp || goingDown) ambFade(t, want, t.wanted > 0 && want > 0 ? 200 : AMBIENT_FADE);   // a volume change is quick
        t.wanted = want;
    }
    renderAmbientUi();
}

function renderAmbientUi() {
    const scene = aesthetic.scene;
    const t = ambTracks[scene];
    const names = AMBIENT_NAMES[scene] || ['Sound', 'Ambient sound'];
    // hidden until the file is known to exist, and for good if it is missing
    ambSoundBtn.parentElement.hidden = !t || t.state !== 'ok';
    const on = ui.ambient.on;
    ambSoundBtn.classList.toggle('on', on);
    ambSoundBtn.setAttribute('aria-pressed', String(on));
    ambSoundName.textContent = on ? (ambBlocked ? 'Tap to enable sound' : names[0]) : 'Sound off';
    ambSoundBtn.setAttribute('aria-label', on ? `Ambient sound: ${names[1]}. Turn off` : 'Ambient sound off. Turn on');
    ambPop.hidden = !on;
    ambPopName.textContent = names[1];
    setRange(ambPopRange, ui.ambient.volume, 100);
    ambPopRange.setAttribute('aria-valuetext', `${ui.ambient.volume}%`);
    ambPopPct.textContent = `${ui.ambient.volume}%`;
}

function renderAmbientSettings() {
    ambSwitch.checked = ui.ambient.on;
    setRange(ambRange, ui.ambient.volume, 100);
    ambRange.setAttribute('aria-valuetext', `${ui.ambient.volume}%`);
    ambPct.textContent = `${ui.ambient.volume}%`;
}

function changeAmbient(key, value) {
    changeUi('ambient', cleanAmbient({ ...ui.ambient, [key]: value }));   // saved and synced (appearance.js)
    renderAmbientSettings();
    syncAmbient();
}

// A live preview while the slider moves; saved when it is let go
function previewAmbient(value) {
    const v = Math.round(clamp(Number(value), 0, 100) / 5) * 5;
    ui.ambient.volume = v;
    renderAmbientSettings();
    syncAmbient();
}

ambSoundBtn.addEventListener('click', () => {
    if (ui.ambient.on && ambBlocked) { ambBlocked = false; syncAmbient(); return; }   // the press itself unlocks sound
    changeAmbient('on', !ui.ambient.on);
});
ambSwitch.addEventListener('change', () => changeAmbient('on', ambSwitch.checked));
[ambRange, ambPopRange].forEach((r) => {
    r.addEventListener('input', () => previewAmbient(r.value));
    r.addEventListener('change', () => changeAmbient('volume', Number(r.value)));
});

renderAmbientSettings();
renderAmbientUi();
