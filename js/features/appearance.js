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
if (!['sora', 'mono', 'inter', 'dmsans'].includes(ui.font)) ui.font = 'sora';
if (!TEXT_WEIGHTS.includes(Number(ui.textWeight))) ui.textWeight = 300;
ui.textWeight = Number(ui.textWeight);
ui.weights = { ...DEFAULT_WEIGHTS, ...(ui.weights || {}) };
for (const f of Object.keys(FONT_WEIGHTS)) {
    if (!FONT_WEIGHTS[f].includes(Number(ui.weights[f]))) ui.weights[f] = DEFAULT_WEIGHTS[f];
    ui.weights[f] = Number(ui.weights[f]);
}
if (!/^#[0-9a-f]{6}$/i.test(ui.accent)) ui.accent = DEFAULT_ACCENT;
const THEMES = ['dark', 'light', 'system', 'graphite', 'paper', 'wine', 'vanilla', 'olive', 'forest', 'electric-blue'];

// Colour themes: [background, text]. Their default accent is the text or the background colour,
// whichever stands out more where the accent is drawn: on the theme's own background (so in practice the text colour).
const THEME_COLORS = {
    wine: ['#7f011f', '#f5ebd0'],
    vanilla: ['#eeebda', '#282b4a'],
    olive: ['#d2db76', '#2d371d'],
    forest: ['#064734', '#e0ffc2'],
    'electric-blue': ['#0246f1', '#edf1f5']
};

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
const BACKGROUNDS = ['solid', 'midnight', 'glow', 'dots', 'photo'];
if (!THEMES.includes(ui.theme)) ui.theme = 'dark';
if (!BACKGROUNDS.includes(ui.bg)) ui.bg = 'solid';

const themeTiles = document.querySelectorAll('[data-theme-choice]');
const bgTiles = document.querySelectorAll('[data-bg-choice]');
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
const bgPhotoInput = $('bg-photo-input');
const bgPhotoPrev = $('bg-photo-prev');
const bgPhotoNote = $('bg-photo-note');

// 5 even steps from white (0h) to the accent color (4h+)
function paletteFor(hex) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return [0, 1, 2, 3, 4].map((k) =>
        '#' + rgb.map((c) => Math.round(255 - (255 - c) * (k / 4)).toString(16).padStart(2, '0')).join(''));
}

// The photo background lives on this device only (too big to sync)
const getBgPhoto = () => { try { return localStorage.getItem('bgPhoto'); } catch { return null; } };

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
    const photo = ui.bg === 'photo' ? getBgPhoto() : null;
    root.dataset.bg = ui.bg === 'photo' && !photo ? 'solid' : ui.bg;
    if (photo) root.style.setProperty('--bg-photo', `url("${photo}")`);
    else root.style.removeProperty('--bg-photo');
    const stored = getBgPhoto();
    bgPhotoPrev.textContent = stored ? '' : '+ Photo';
    bgPhotoPrev.style.backgroundImage = stored ? `url("${stored}")` : '';
    bgPhotoNote.hidden = !(ui.bg === 'photo' && !photo);
    bgPhotoNote.textContent = 'The photo is kept on the device where you chose it. Pick one here to use it on this device too.';

    press(themeTiles, (b) => b.dataset.themeChoice === ui.theme);
    press(bgTiles, (b) => b.dataset.bgChoice === ui.bg);
    press(fontTiles, (b) => b.dataset.fontChoice === ui.font);
    press(formatBtns, (b) => b.dataset.formatChoice === ui.format);
    secondsSwitch.checked = ui.seconds;
    setRange(textWeightRange, TEXT_WEIGHTS.indexOf(ui.textWeight), TEXT_WEIGHTS.length - 1);
    textWeightRange.setAttribute('aria-valuetext', `${WEIGHT_NAMES[ui.textWeight]} (${ui.textWeight})`);
    root.style.setProperty('--w', String(ui.textWeight));
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
    paletteFor(ui.accent).forEach((c, i) => root.style.setProperty(`--p${i}`, c));
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
if (systemLight && systemLight.addEventListener) systemLight.addEventListener('change', () => { if (ui.theme === 'system') applyUi(); });

// Backgrounds: the photo tile asks for an image the first time (and again when clicked while chosen)
bgTiles.forEach((b) => b.addEventListener('click', () => {
    const choice = b.dataset.bgChoice;
    if (choice === 'photo' && (!getBgPhoto() || ui.bg === 'photo')) return bgPhotoInput.click();
    changeUi('bg', choice);
}));

// The photo is shrunk to at most 1600 px and saved as a JPEG, so it fits in the browser's storage
bgPhotoInput.addEventListener('change', () => {
    const file = bgPhotoInput.files && bgPhotoInput.files[0];
    bgPhotoInput.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
            localStorage.setItem('bgPhoto', canvas.toDataURL('image/jpeg', 0.82));
        } catch {
            bgPhotoNote.hidden = false;
            bgPhotoNote.textContent = 'This image is too large to keep in the browser. Try a smaller one.';
            return;
        }
        changeUi('bg', 'photo');
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
});
