// Clockus — "Goal reached": a quiet animation when the daily or weekly focus goal is reached (no confetti)
// Loaded as a classic script (shared global scope). Load order is set in app.html (after aesthetic-mode.js).
//
// - Today bar (Focus tab): the bar reaches 100%, a light crosses it once, then the goal number becomes
//   "goal reached ✓" with a soft glow that fades. About 2 seconds. The bar stays full, the label stays all day.
// - Weekly (Goals, in Stats): the same glow on the week panel; its label becomes "Week goal reached ✓".
// - Aesthetic mode: a soft halo opens around the widget and fades; then the label says "Goal reached ✓".
// Never in the way: no window, no stopped timer, nothing moves. Once per goal: plays when the goal is passed
// while the page is open; after a reload you see the settled state. Resets at midnight (daily) and on Monday (weekly).
// Reduce motion (your system, or Animations off): no light and no halo, the label just changes.

// ---------- Settings (this device only, key `goalAnim`) ----------
function cleanGoalAnim(a) {
    const x = a && typeof a === 'object' ? a : {};
    return { on: x.on !== false, sound: x.sound === true };
}

let goalAnim = cleanGoalAnim(store.get('goalAnim', null));
const gaSwitch = $('ga-switch');
const gaSound = $('ga-sound');
const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const goalMotion = () => goalAnim.on && ui.animations && !reduceMotionMq.matches;

function renderGoalAnimSettings() {
    gaSwitch.checked = goalAnim.on;
    gaSound.checked = goalAnim.sound;
    $('ga-sound-row').classList.toggle('off', !goalAnim.on);
}

function changeGoalAnim(key, value) {
    goalAnim[key] = value;
    goalAnim = cleanGoalAnim(goalAnim);
    store.set('goalAnim', goalAnim);
    renderGoalAnimSettings();
}

gaSwitch.addEventListener('change', () => changeGoalAnim('on', gaSwitch.checked));
gaSound.addEventListener('change', () => {
    changeGoalAnim('sound', gaSound.checked);
    if (goalAnim.sound) goalChime();   // a preview
});

// A very soft chime: the reminder chime, at a low volume
const goalChime = () => playChime(25);

// ---------- Once per goal ----------
// `goalAnimSeen` = { day: 'YYYY-MM-DD', week: Monday's 'YYYY-MM-DD' }: the goal already counted (played or settled)
const gaSeen = () => Object.assign({ day: '', week: '' }, store.get('goalAnimSeen', null) || {});
function gaMark(kind, key) {
    const s = gaSeen();
    s[kind] = key;
    store.set('goalAnimSeen', s);
}

let gaLastFocus = 0;       // focus time reaches the bar about a second after it is counted, so allow a few seconds
let gaDayPrev = null;      // reached at the last check (null: not checked yet in this page)
let gaWeekPrev = null;
let gaDayPending = null;   // the day whose animation still has to play (it waits until the bar or the widget is on screen)
let gaWeekPending = null;
let gaHoldUntil = 0;       // the Today bar keeps "goal 2h" until the light has crossed it
let gaWeekHoldUntil = 0;
let gaWidgetUntil = 0;     // the widget label says "Goal reached ✓" until then

const goalFxHold = () => Date.now() < gaHoldUntil;
const goalFxWeekHold = () => Date.now() < gaWeekHoldUntil;
const goalFxWidgetLabel = () => Date.now() < gaWidgetUntil;

// Called by renderGoalLine (goals.js) each time the Today bar is drawn
function goalFxCheck(dayReached, weekReached) {
    const todayK = dayKey();
    const weekK = mondayOf(todayK);
    const seen = gaSeen();
    if (running && mode === 'focus') gaLastFocus = Date.now();
    // Passed during a focus session here (not focus time arriving from another device)
    const live = Date.now() - gaLastFocus < 5000;
    // Already reached when the page opens (or another tab got there first): the settled state, no replay
    if (dayReached && seen.day !== todayK) {
        gaMark('day', todayK);
        if (gaDayPrev === false && live) gaDayPending = todayK;
    }
    if (weekReached && seen.week !== weekK) {
        gaMark('week', weekK);
        if (gaWeekPrev === false && live) gaWeekPending = weekK;
    }
    gaDayPrev = dayReached;
    gaWeekPrev = weekReached;
    if (gaDayPending && gaDayPending !== todayK) gaDayPending = null;   // past midnight: too late
    if (gaWeekPending && gaWeekPending !== weekK) gaWeekPending = null;
    gaPlayDay();
}

const goalLineShown = () => !goalLine.hidden && goalLine.offsetParent !== null && document.visibilityState === 'visible';

function gaPlayDay() {
    if (!gaDayPending) return;
    if (!goalAnim.on) { gaDayPending = null; return; }
    if (aesOpen) {
        if (document.visibilityState !== 'visible') return;
        gaDayPending = null;
        playWidgetHalo();
    } else if (goalLineShown()) {
        gaDayPending = null;
        playBarLight();
    } else {
        return;
    }
    if (goalAnim.sound) goalChime();
}

// ---------- Today bar: the light, then the label, then the glow fades ----------
const gaLight = makeEl('span', 'goal-fx-light');
const gaGlow = makeEl('span', 'goal-fx-glow');
const gaMsg = makeEl('span', 'goal-fx-msg', 'Goal reached');
[gaLight, gaGlow, gaMsg].forEach((el) => el.setAttribute('aria-hidden', 'true'));
goalLine.querySelector('.goal-line-track').append(gaLight);
goalLine.append(gaGlow, gaMsg);

function playBarLight() {
    if (!goalMotion()) return;   // reduce motion: the bar just fills and the label changes
    const LABEL_AT = 1400;
    gaHoldUntil = Date.now() + LABEL_AT;
    renderGoalLine();            // keep "goal 2h" until the light has crossed
    goalLine.classList.add('fx');
    // 0.3 s: the bar is full, the light starts; it crosses once, slowly, until 1.4 s
    gaLight.animate([
        { left: '0%', opacity: 0, offset: 0 },
        { left: '0%', opacity: 0, offset: 0.14 },
        { left: '6%', opacity: 1, offset: 0.22 },
        { left: '94%', opacity: 1, offset: 0.62 },
        { left: '100%', opacity: 0, offset: 0.7 },
        { left: '100%', opacity: 0, offset: 1 }
    ], { duration: 2000, easing: 'linear' });
    // 1.4 s: the label changes, with a soft glow and "Goal reached" under the bar; 2.0 s and after: it fades
    const glow = [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: 0.55 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0.7, offset: 0.82 },
        { opacity: 0, offset: 1 }
    ];
    gaGlow.animate(glow, { duration: 2600, easing: 'ease-out' });
    gaMsg.animate(glow, { duration: 2600, easing: 'ease-out' });
    setTimeout(() => {
        renderGoalLine();
        $('goal-line-goal').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
    }, LABEL_AT);
    setTimeout(() => goalLine.classList.remove('fx'), 2700);
}

// ---------- Aesthetic mode: a halo around the widget, like a breath ----------
const gaHalo = makeEl('span', 'aes-halo');
gaHalo.setAttribute('aria-hidden', 'true');
aesWidget.prepend(gaHalo);

// The label says what happened for a minute, then the widget is back to "Focus"
function showWidgetLabel() {
    gaWidgetUntil = Date.now() + 60000;
    renderAesthetic();
}

function playWidgetHalo() {
    if (!goalMotion()) { showWidgetLabel(); return; }
    gaHalo.animate([
        { opacity: 0, transform: 'scale(1)', offset: 0 },
        { opacity: 0.9, transform: 'scale(1.03)', offset: 0.2 },
        { opacity: 0.5, transform: 'scale(1.07)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.09)', offset: 1 }
    ], { duration: 2000, easing: 'ease-out' });
    // 2.0 s: back to normal, the label changes
    setTimeout(() => {
        showWidgetLabel();
        $('aes-label-text').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
    }, 2000);
}

// ---------- Weekly: the same glow on the week panel, "Week goal reached ✓" ----------
// Called at the end of renderGoals (goals.js)
function goalFxWeek() {
    if (!gaWeekPending || document.visibilityState !== 'visible') return;
    if (!goalAnim.on) { gaWeekPending = null; return; }
    const panel = $('goal-week');
    if (panel.offsetParent === null) return;   // Stats is not open yet: it waits
    gaWeekPending = null;
    if (goalAnim.sound) goalChime();
    if (!goalMotion()) return;
    const LABEL_AT = 1400;
    gaWeekHoldUntil = Date.now() + LABEL_AT;
    renderGoals();
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--cal-acc').trim() || '#7c5cff';
    panel.animate([
        { boxShadow: `0 0 0 0 transparent`, offset: 0 },
        { boxShadow: `0 0 0 0 transparent`, offset: 0.5 },
        { boxShadow: `0 0 0 1px ${acc}, 0 0 44px -6px ${acc}`, offset: 0.7 },
        { boxShadow: `0 0 0 0 transparent`, offset: 1 }
    ], { duration: 2600, easing: 'ease-out' });
    setTimeout(() => {
        if (document.body.dataset.tab === 'stats') renderGoals();
        const l = panel.querySelector('.gw-reached');
        if (l) l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
    }, LABEL_AT);
}

// A pending animation plays as soon as its bar (or the widget) is on screen
setInterval(() => {
    gaPlayDay();
    if (gaWeekPending && document.body.dataset.tab === 'stats') goalFxWeek();
}, 1000);

// Other tabs of this browser: same settings
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.key !== 'goalAnim') return;
    goalAnim = cleanGoalAnim(store.get('goalAnim', null));
    renderGoalAnimSettings();
});

renderGoalAnimSettings();
