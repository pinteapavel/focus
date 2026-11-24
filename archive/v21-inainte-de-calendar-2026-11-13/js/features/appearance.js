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
const themeSelect = $('theme-select');
const formatSelect = $('format-select');
const secondsSwitch = $('seconds-switch');
const fontSelect = $('font-select');
const textWeightSelect = $('text-weight-select');
textWeightSelect.replaceChildren(...TEXT_WEIGHTS.map((w) => new Option(`${WEIGHT_NAMES[w]} (${w})`, String(w))));
const weightRow = $('weight-row');
const weightSelect = $('weight-select');
const animationsSwitch = $('animations-switch');
const motionNote = $('motion-note');
const systemReducesMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    textWeightSelect.value = String(ui.textWeight);
    document.documentElement.style.setProperty('--w', String(ui.textWeight));
    const weights = FONT_WEIGHTS[ui.font];
    weightRow.hidden = !weights;
    if (weights) {
        if (weightSelect.dataset.font !== ui.font) {   // list every variant of the chosen font
            weightSelect.replaceChildren(...weights.map((w) => new Option(`${WEIGHT_NAMES[w]} (${w})`, String(w))));
            weightSelect.dataset.font = ui.font;
        }
        weightSelect.value = String(ui.weights[ui.font]);
        document.documentElement.style.setProperty('--clock-weight', String(ui.weights[ui.font]));
    }
    animationsSwitch.checked = ui.animations;
    // How many digits the clock shows decides how large it can be on a narrow screen
    realtimeEl.style.setProperty('--fit', String((ui.seconds ? 5.4 : 3.4) + (ui.format === '12' ? 0.45 : 0)));
    motionNote.hidden = !systemReducesMotion;
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
textWeightSelect.addEventListener('change', () => changeUi('textWeight', Number(textWeightSelect.value)));
weightSelect.addEventListener('change', () => changeUi('weights', { ...ui.weights, [ui.font]: Number(weightSelect.value) }));
animationsSwitch.addEventListener('change', () => changeUi('animations', animationsSwitch.checked));
swatchBtns.forEach((b) => b.addEventListener('click', () => changeUi('accent', b.dataset.color)));
accentCustom.addEventListener('input', () => { ui.accent = accentCustom.value; applyUi(); }); // live preview
accentCustom.addEventListener('change', () => changeUi('accent', accentCustom.value));
