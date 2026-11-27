// Clockus — appearance settings: theme, fonts, weights, accent color, animations
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Appearance settings ----------
const DEFAULT_ACCENT = '#5b21b6';
const WEIGHT_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black', 1000: 'ExtraBlack' };
const TEXT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800];
const FONT_WEIGHTS = {
    sora: [100, 200, 300, 400, 500, 600, 700, 800],
    inter: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    dmsans: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
};
const DEFAULT_WEIGHTS = { sora: 500, inter: 700, dmsans: 400 };
const savedUi = store.get('ui', {});
if (savedUi.v !== 2) {                      // Sora is the new main font: the old default clock font moves to it
    if (savedUi.font === 'mono') savedUi.font = 'sora';
    savedUi.v = 2;
}
const ui = Object.assign({
    theme: 'dark', format: '24', seconds: true, font: 'sora', accent: DEFAULT_ACCENT, textWeight: 300, v: 2,
    // Animations follow the system setting for reduced motion until the user chooses
    animations: !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}, savedUi);
if (typeof ui.animations !== 'boolean') ui.animations = true;
// Glow: a soft light in the accent colour at the bottom of Home and Focus. One value, Strong by default.
// It shows only with these themes; with the others the choice is kept and comes back with them.
const GLOW_LEVELS = ['off', 'soft', 'strong'];
const GLOW_THEMES = ['dark', 'light', 'graphite', 'paper'];
if (!GLOW_LEVELS.includes(ui.glow)) ui.glow = 'strong';
// Glass (css/glass.css): Off, Soft, Strong, on every theme. Until the person picks one, each device takes its own default:
// Strong on a computer, Soft on a phone or small screen. A device that asks for less transparency always gets Off.
const GLASS_LEVELS = ['off', 'soft', 'strong'];
if (ui.glass !== undefined && !GLASS_LEVELS.includes(ui.glass)) delete ui.glass;
const lessTransparency = window.matchMedia ? window.matchMedia('(prefers-reduced-transparency: reduce)') : { matches: false };
const smallScreen = window.matchMedia ? window.matchMedia('(max-width: 600px)') : { matches: false };
const glassLevel = () => (lessTransparency.matches ? 'off' : ui.glass || (smallScreen.matches ? 'soft' : 'strong'));
if (!['sora', 'mono', 'inter', 'dmsans'].includes(ui.font)) ui.font = 'sora';
if (!TEXT_WEIGHTS.includes(Number(ui.textWeight))) ui.textWeight = 300;
ui.textWeight = Number(ui.textWeight);
ui.weights = { ...DEFAULT_WEIGHTS, ...(ui.weights || {}) };
for (const f of Object.keys(FONT_WEIGHTS)) {
    if (!FONT_WEIGHTS[f].includes(Number(ui.weights[f]))) ui.weights[f] = DEFAULT_WEIGHTS[f];
    ui.weights[f] = Number(ui.weights[f]);
}
if (!/^#[0-9a-f]{6}$/i.test(ui.accent)) ui.accent = DEFAULT_ACCENT;
// Animated: the chosen video behind the site, with the colours of Dark (animated-theme.js). System left the list.
const THEMES = ['animated', 'dark', 'light', 'graphite', 'paper', 'blush', 'vanilla', 'olive', 'forest', 'deep-sea'];

// Colour themes: [background, text], the same values as --th-*-bg / --th-*-text in app.css. Their default accent is
// the text or the background colour, whichever stands out more where the accent is drawn: on the theme's own
// background (so in practice the text colour).
const THEME_COLORS = {
    blush: ['#7b3b4b', '#dfd4d8'],
    vanilla: ['#f0e7d5', '#212842'],
    olive: ['#d2db76', '#2d371d'],
    forest: ['#00311f', '#fff7e6'],
    'deep-sea': ['#156874', '#ede6e6']
};
// Vanilla got new colours (Version 33): an accent still on its old default follows the new one
if (ui.theme === 'vanilla' && ui.accent.toLowerCase() === '#282b4a') ui.accent = THEME_COLORS.vanilla[1];

// Wine became Blush and Electric Blue became Deep Sea; Forest kept its name but got new colours.
// A saved old name moves to the new one; an accent still on the old theme's default follows the new default
// (an accent you chose yourself stays). Also used for settings that arrive from another device (sync.js).
// System left the Classic row: a saved System becomes Dark, the accent stays.
const THEME_RENAMED = { wine: ['blush', '#f5ebd0'], 'electric-blue': ['deep-sea', '#edf1f5'], forest: ['forest', '#e0ffc2'], system: ['dark', null] };
function migrateTheme(u) {
    const old = THEME_RENAMED[u.theme];
    if (!old) return false;
    const accent = String(u.accent || '').toLowerCase() === old[1] ? THEME_COLORS[old[0]][1] : u.accent;
    const changed = u.theme !== old[0] || accent !== u.accent;
    u.theme = old[0];
    u.accent = accent;
    return changed;
}
if (migrateTheme(ui)) store.set('ui', ui);
// First visit (nothing of Clockus saved yet, decided in app.html's head): the Animated theme is the default.
// Saved so it stays on the next visit; without a time (ui.at), so the settings of an account signed in later win.
// Glass is not saved: each device keeps its own default until the person picks a level.
if (window.clockusFirstVisit && !store.get('ui', null)) {
    ui.theme = 'animated';
    store.set('ui', ui);
}

function luminance(hex) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

function themeAccent(theme) {
    const c = THEME_COLORS[theme];
    if (!c) return null;
    const [bg, text] = c;
    return contrast(text, bg) >= contrast(bg, bg) ? text : bg;
}
// The Background choice left Settings: the background comes only from the theme. The old value (ui.bg) is still
// read, kept and synced unchanged, so nothing saved is lost, but it is no longer shown.
const BACKGROUNDS = ['solid', 'midnight', 'glow', 'dots', 'photo'];
if (!THEMES.includes(ui.theme)) ui.theme = 'dark';
if (!BACKGROUNDS.includes(ui.bg)) ui.bg = 'solid';

const themeTiles = document.querySelectorAll('[data-theme-choice]');
const fontTiles = document.querySelectorAll('[data-font-choice]');
const formatBtns = document.querySelectorAll('[data-format-choice]');
const secondsSwitch = $('seconds-switch');
const textWeightRange = $('text-weight-range');
const weightRow = $('weight-row');
const weightRange = $('weight-range');
const animationsSwitch = $('animations-switch');
const motionNote = $('motion-note');
const systemReducesMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const systemLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const rtAmpm = $('rt-ampm');
const swatchBtns = document.querySelectorAll('.swatch[data-color]');
const customSwatch = $('swatch-custom');
const accentCustom = $('accent-custom');
const glowRow = $('glow-row');
const glowBtns = document.querySelectorAll('[data-glow-choice]');
const glassRow = $('glass-row');
const glassNote = $('glass-note');
const glassBtns = document.querySelectorAll('[data-glass-choice]');
const GLASS_NOTE = glassNote.textContent;

// 5 even steps from white (0h) to the accent color (4h+)
function paletteFor(hex) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return [0, 1, 2, 3, 4].map((k) =>
        '#' + rgb.map((c) => Math.round(255 - (255 - c) * (k / 4)).toString(16).padStart(2, '0')).join(''));
}

const press = (els, test) => els.forEach((b) => {
    const on = test(b);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
});

// A range slider shows how far it is filled
function setRange(input, index, max) {
    input.max = String(max);
    input.value = String(index);
    input.style.setProperty('--pct', `${max ? (index / max) * 100 : 0}%`);
}

function applyUi() {
    const root = document.documentElement;
    const resolved = ui.theme === 'system' ? (systemLight && systemLight.matches ? 'light' : 'dark') : ui.theme;
    root.dataset.theme = resolved;
    root.dataset.font = ui.font;
    root.dataset.bg = 'solid';   // the background comes from the theme (the colour themes need [data-bg] set)

    press(themeTiles, (b) => b.dataset.themeChoice === ui.theme);
    // Glow: drawn by CSS from data-glow (app.css). Other themes: the row is dimmed and its buttons disabled
    const glowOk = GLOW_THEMES.includes(ui.theme);
    root.dataset.glow = glowOk ? ui.glow : 'off';
    press(glowBtns, (b) => b.dataset.glowChoice === ui.glow);
    glowBtns.forEach((b) => { b.disabled = !glowOk; });
    glowRow.classList.toggle('off', !glowOk);
    // Glass: data-glass picks the level's values in glass.css. Less transparency asked: Off, the row greyed with why
    const glass = glassLevel();
    root.dataset.glass = glass;
    press(glassBtns, (b) => b.dataset.glassChoice === glass);
    glassBtns.forEach((b) => { b.disabled = lessTransparency.matches; });
    glassRow.classList.toggle('off', lessTransparency.matches);
    glassNote.textContent = lessTransparency.matches ? 'Turned off because your device asks for less transparency.' : GLASS_NOTE;
    press(fontTiles, (b) => b.dataset.fontChoice === ui.font);
    press(formatBtns, (b) => b.dataset.formatChoice === ui.format);
    secondsSwitch.checked = ui.seconds;
    setRange(textWeightRange, TEXT_WEIGHTS.indexOf(ui.textWeight), TEXT_WEIGHTS.length - 1);
    textWeightRange.setAttribute('aria-valuetext', `${WEIGHT_NAMES[ui.textWeight]} (${ui.textWeight})`);
    root.style.setProperty('--w', String(ui.textWeight));
    root.dataset.animations = ui.animations ? 'on' : 'off';   // glass.css: no transitions when off
    const weights = FONT_WEIGHTS[ui.font];
    weightRow.hidden = !weights;
    if (weights) {
        const w = ui.weights[ui.font];
        setRange(weightRange, weights.indexOf(w), weights.length - 1);
        weightRange.setAttribute('aria-valuetext', `${WEIGHT_NAMES[w]} (${w})`);
        $('weight-name').textContent = `${WEIGHT_NAMES[w]} (${w})`;
        root.style.setProperty('--clock-weight', String(w));
    }
    animationsSwitch.checked = ui.animations;
    // How many digits the clock shows decides how large it can be on a narrow screen
    realtimeEl.style.setProperty('--fit', String((ui.seconds ? 5.4 : 3.4) + (ui.format === '12' ? 0.45 : 0)));
    motionNote.hidden = !systemReducesMotion;
    const pal = paletteFor(ui.accent);
    pal.forEach((c, i) => root.style.setProperty(`--p${i}`, c));
    // Text and icons drawn on the accent (today in the calendar, the avatar, chosen days): white, near black or the
    // theme's background, whichever reads best on the shade the theme uses (--cal-acc). The accent itself is unchanged.
    const accShade = ['dark', 'graphite', 'animated'].includes(resolved) ? pal[3] : pal[4];
    const onAcc = ['#ffffff', '#111111'].concat(THEME_COLORS[ui.theme] ? [THEME_COLORS[ui.theme][0]] : [])
        .reduce((best, c) => (contrast(c, accShade) > contrast(best, accShade) ? c : best));
    root.style.setProperty('--on-acc', onAcc);
    let isPreset = false;
    swatchBtns.forEach((b) => {
        b.style.setProperty('--c', paletteFor(b.dataset.color)[3]);   // shown in the tone used on screen
        const on = b.dataset.color.toLowerCase() === ui.accent.toLowerCase();
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
        if (on) isPreset = true;
    });
    customSwatch.classList.toggle('active', !isPreset);
    customSwatch.classList.toggle('has-color', !isPreset);
    customSwatch.style.setProperty('--c', ui.accent);
    accentCustom.value = ui.accent;
    updateRealtime();
    if (typeof renderSettingsSummary === 'function') renderSettingsSummary();
    if (typeof syncThemeBg === 'function') syncThemeBg();   // the Animated theme's video (animated-theme.js)
}

function changeUi(key, value) {
    ui[key] = value;
    ui.at = Date.now();   // when it changed: the newest look wins between devices
    store.set('ui', ui);
    applyUi();
    pushSettings();
}

// A colour theme brings its own accent. If the accent is still the previous theme's default, it follows the theme;
// an accent you chose yourself stays.
themeTiles.forEach((b) => b.addEventListener('click', () => {
    const next = b.dataset.themeChoice;
    const wasDefault = (themeAccent(ui.theme) || DEFAULT_ACCENT).toLowerCase();
    if (ui.accent.toLowerCase() === wasDefault) ui.accent = themeAccent(next) || DEFAULT_ACCENT;
    changeUi('theme', next);
}));
fontTiles.forEach((b) => b.addEventListener('click', () => changeUi('font', b.dataset.fontChoice)));
formatBtns.forEach((b) => b.addEventListener('click', () => changeUi('format', b.dataset.formatChoice)));
secondsSwitch.addEventListener('change', () => changeUi('seconds', secondsSwitch.checked));
textWeightRange.addEventListener('input', () => changeUi('textWeight', TEXT_WEIGHTS[Number(textWeightRange.value)]));
weightRange.addEventListener('input', () => changeUi('weights', { ...ui.weights, [ui.font]: FONT_WEIGHTS[ui.font][Number(weightRange.value)] }));
animationsSwitch.addEventListener('change', () => changeUi('animations', animationsSwitch.checked));
swatchBtns.forEach((b) => b.addEventListener('click', () => changeUi('accent', b.dataset.color)));
accentCustom.addEventListener('input', () => { ui.accent = accentCustom.value; applyUi(); }); // live preview
accentCustom.addEventListener('change', () => changeUi('accent', accentCustom.value));
glowBtns.forEach((b) => b.addEventListener('click', () => changeUi('glow', b.dataset.glowChoice)));
glassBtns.forEach((b) => b.addEventListener('click', () => changeUi('glass', b.dataset.glassChoice)));
// The device setting or the window size changed: the forced Off and the default follow
[lessTransparency, smallScreen].forEach((mq) => { if (mq.addEventListener) mq.addEventListener('change', applyUi); });
if (systemLight && systemLight.addEventListener) systemLight.addEventListener('change', () => { if (ui.theme === 'system') applyUi(); });
