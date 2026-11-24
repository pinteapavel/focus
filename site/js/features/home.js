// Clockus — Home tab (was Clock): the clock, the date, the "Up next" capsule and up to four chips
// Loaded as a classic script (shared global scope). Load order is set in app.html (after goal-reached.js).
//
// No data of its own: everything comes from To do (tasks, top priority), Calendar (dates), Goals and Stats
// (focus log, streak). The look follows the mode you use on Focus: after Aesthetic mode (A), the video
// background shows through glass; after Clean mode (F), or before either, the plain background.
// That choice is remembered in the existing device-only key `aesthetic` (field `home`).

const homeContainer = $('home-container');
const homeCap = $('home-cap');
const homeChips = $('home-chips');
const homeDate = $('rt-date');
const homeBg = $('home-bg');
const homeBgScene = $('home-bg-scene');
const homeBgVideo = $('home-bg-video');
const homeBgDim = $('home-bg-dim');

const HOME_DURATIONS = [25, 50, 60];
const HOME_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HOME_ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5.5" width="3" height="13" rx="1"/><rect x="14" y="5.5" width="3" height="13" rx="1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>'
};

const homeOpen = () => document.body.dataset.tab === 'clock';

// ---------- The look: Aesthetic (video and glass) or Clean ----------
// Called by setAesthetic() (aesthetic-mode.js) and setClean() (clean-mode.js) when you turn one on from Focus
function homeRememberLook(aes) {
    if (aesthetic.home === aes) return;
    aesthetic.home = aes;
    store.set('aesthetic', aesthetic);
    syncHomeBg();
}

// The video loads only while Home is on screen in the Aesthetic look; it stops when the tab is hidden
// Changing tab, the background fades like the page (in 450 ms, out in 300 ms) instead of cutting
let homeBgOn = false;       // what was last asked for
let homeBgOut = null;       // the fade out, while it runs
function syncHomeBg() {
    // The video belongs to the Animated theme only: then the whole site already has it (animated-theme.js) and Home
    // only adds its glass. With any other theme Home shows the theme's colour, whatever mode was used last.
    const siteVideo = ui.theme === 'animated';
    const glass = homeOpen() && siteVideo && !aesOpen;
    document.body.classList.toggle('home-aes', glass);
    const on = false;   // Home's own copy of the video is no longer used (it stays hidden and paused)
    const changed = on !== homeBgOn;
    homeBgOn = on;
    const animate = changed && ui.animations && !!homeBg.animate;
    if (homeBgOut) { homeBgOut.cancel(); homeBgOut = null; }

    if (!on && animate && !homeBg.hidden) {
        // Fade out with the page; the video keeps playing until it is gone
        const fade = homeBg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
        homeBgOut = fade;
        fade.onfinish = () => {
            if (homeBgOut !== fade) return;
            homeBgOut = null;
            homeBg.hidden = true;
            fade.cancel();
            homeBgVideo.pause();
        };
        return;
    }
    if (on && animate && homeBg.hidden) {
        homeBg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
    }
    homeBg.hidden = !on;
    const video = on ? AES_VIDEOS[aesthetic.scene] : null;
    homeBgScene.dataset.scene = aesthetic.scene;
    homeBgDim.style.opacity = String((aesthetic.dim / 100) * 0.8);
    const play = !!video && ui.animations && !document.hidden;
    if (play && homeBgVideo.getAttribute('src') !== video.src) {
        homeBgVideo.poster = video.poster;
        homeBgVideo.src = video.src;
    }
    homeBgVideo.hidden = !video || !ui.animations;
    if (play && homeBgVideo.paused) {
        homeBgVideo.muted = true;
        const p = homeBgVideo.play();
        if (p && p.catch) p.catch(() => {});
    } else if (!play && !homeBgVideo.paused) {
        homeBgVideo.pause();
    }
}
document.addEventListener('visibilitychange', syncHomeBg);

// ---------- Data (read only) ----------
// Up next: the top priority task; if none, the first task due today, then the first open task
// (tasks dated after today wait for their day)
function homeUpNext(todayK) {
    const open = tasks.filter((t) => !t.done);
    return open.find((t) => t.id === topPriorityId)
        || open.find((t) => t.date === todayK)
        || open.find((t) => !t.date || t.date < todayK)
        || null;
}

// Same rule as the Stats tab: a day with 1h+ of focus counts; today counts once it reaches 1h
function homeStreak(totals) {
    const ms = (d) => totals[dayKey(d)] || 0;
    const from = ms(dateAgo(0)) >= HOUR_MS ? 0 : 1;
    let n = 0;
    while (n < 365 && ms(dateAgo(from + n)) >= HOUR_MS) n++;
    return n;
}

// "Fri", "Tomorrow", "4 Dec"
function homeDayLabel(k, todayK) {
    const d = keyToDate(k);
    const diff = Math.round((d - keyToDate(todayK)) / 86400000);
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return CAL_DOW[(d.getDay() + 6) % 7];
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function homeState() {
    const todayK = dayKey();
    const totals = totalsByDay();
    const active = running || paused || mode === 'break';
    const s = { todayK, active };

    if (active) {
        const t = tasks.find((x) => x.id === currentTaskId && !x.done);
        s.label = paused ? 'Paused' : mode === 'break' ? 'On a break' : 'Focusing now';
        s.what = mode === 'break' ? 'Break' : t ? t.text : 'Focus';
        s.running = running;
    } else {
        const next = homeUpNext(todayK);
        if (next) {
            s.kind = 'task';
            s.task = { id: next.id, text: next.text };
            s.focus = settings.focus;
        } else if (tasks.some((t) => t.done && t.doneOn === today())) {
            s.kind = 'done';
            const tomorrow = addDays(todayK, 1);
            const t = tasks.find((x) => !x.done && x.date === tomorrow && x.id === topPriorityId)
                || tasks.find((x) => !x.done && x.date === tomorrow);
            s.tomorrow = t ? t.text : '';
        } else {
            s.kind = 'empty';
        }
    }

    // Chips
    const ms = totals[todayK] || 0;
    s.goal = goals ? {
        rest: !isActiveDay(todayK),
        done: fmtDuration(ms),
        of: fmtGoal(goals.focus),
        reached: isActiveDay(todayK) && ms >= goals.focus * 60000
    } : null;
    s.streak = homeStreak(totals);
    s.left = tasks.filter((t) => !t.done && (!t.date || t.date <= todayK)).length;
    const later = tasks.filter((t) => !t.done && t.date && t.date > todayK)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0];
    s.coming = later ? { text: later.text, date: later.date, label: homeDayLabel(later.date, todayK) } : null;
    return s;
}

// ---------- Drawing ----------
function homeBtn(cls, icon, text, onClick) {
    const b = makeEl('button', cls);
    b.type = 'button';
    if (icon) b.insertAdjacentHTML('beforeend', HOME_ICONS[icon]);   // fixed markup
    if (text) b.append(makeEl('span', '', text));
    b.addEventListener('click', onClick);
    return b;
}

function homeLeft(label, ...text) {
    const left = makeEl('div', 'hc-text');
    const name = makeEl('span', 'hc-task');
    name.append(...text);
    left.append(makeEl('span', 'hc-label', label), name);
    return left;
}

let homeSig = '';
let homeTimeEl = null;
let homeMenuOpen = false;

function homeStart(taskId) {
    setCurrentTask(taskId);   // a free session has no task
    startTimer();
    showTab('focus');
}

function homeSetFocus(min) {
    focusInput.value = String(min);
    applySettings();          // timer.js: saved and synced like the Focus field, so it is remembered
    renderHome(true);
}

function homeDurationPicker(focus) {
    const wrap = makeEl('div', 'hc-dur-wrap');
    const btn = homeBtn('hc-ghost hc-dur', null, `${focus} min`, () => homeMenu(!homeMenuOpen));
    btn.insertAdjacentHTML('beforeend', HOME_ICONS.chevron);
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', `Focus length: ${focus} minutes. Change`);
    const menu = makeEl('div', 'hc-menu');
    menu.hidden = true;
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Focus length');
    HOME_DURATIONS.forEach((m) => {
        const o = homeBtn('hc-opt' + (m === focus ? ' on' : ''), null, `${m} min`, () => homeSetFocus(m));
        o.setAttribute('aria-pressed', String(m === focus));
        menu.append(o);
    });
    const custom = makeEl('label', 'hc-custom' + (HOME_DURATIONS.includes(focus) ? '' : ' on'));
    const input = makeEl('input');
    input.type = 'number';
    input.min = '1';
    input.max = '180';
    input.value = HOME_DURATIONS.includes(focus) ? '' : String(focus);
    input.placeholder = 'Custom';
    input.setAttribute('aria-label', 'Custom focus length in minutes');
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value) { e.preventDefault(); homeSetFocus(clamp(input.value, 1, 180)); }
    });
    custom.append(input, makeEl('span', '', 'min'));
    menu.append(custom);
    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); homeMenu(false); btn.focus(); }
    });
    wrap.append(btn, menu);
    return wrap;
}

function homeMenu(open) {
    const wrap = homeCap.querySelector('.hc-dur-wrap');
    homeMenuOpen = open && !!wrap;
    if (!wrap) return;
    wrap.querySelector('.hc-menu').hidden = !homeMenuOpen;
    wrap.querySelector('.hc-dur').setAttribute('aria-expanded', String(homeMenuOpen));
    if (homeMenuOpen) (wrap.querySelector('.hc-opt.on') || wrap.querySelector('.hc-opt')).focus();
}

document.addEventListener('pointerdown', (e) => {
    if (homeMenuOpen && !e.target.closest('.hc-dur-wrap')) homeMenu(false);
});

function renderCapsule(s) {
    const right = makeEl('div', 'hc-actions');
    let left;
    homeTimeEl = null;
    homeCap.className = 'home-cap';

    if (s.active) {
        homeCap.classList.add('live');
        homeTimeEl = makeEl('span', 'hc-time', `${format(remaining)} left`);
        left = homeLeft(s.label, `${s.what} · `, homeTimeEl);
        right.append(
            homeBtn('hc-primary', s.running ? 'pause' : 'play', s.running ? 'Pause' : 'Resume', () => {
                if (running) pauseTimer(); else startTimer();
                renderHome(true);
            }),
            homeBtn('hc-ghost', null, 'Open Focus', () => showTab('focus'))
        );
    } else if (s.kind === 'task') {
        left = homeLeft('Up next', s.task.text);
        right.append(homeBtn('hc-primary', 'play', 'Start', () => homeStart(s.task.id)), homeDurationPicker(s.focus));
    } else if (s.kind === 'done') {
        homeCap.classList.add('calm');
        left = homeLeft('Up next', 'All done for today');
        if (s.tomorrow) {
            const t = makeEl('span', 'hc-note');
            t.insertAdjacentHTML('beforeend', HOME_ICONS.check);   // fixed markup
            t.append(makeEl('span', '', `Tomorrow: ${s.tomorrow}`));
            right.append(t);
        }
    } else {
        left = homeLeft('Up next', 'No task yet');
        right.append(
            homeBtn('hc-ghost', 'plus', 'Add a task', () => { showTab('todo'); taskInput.focus(); }),
            homeBtn('hc-primary', 'play', 'Free session', () => homeStart(null))
        );
    }
    homeCap.replaceChildren(left);
    if (right.childElementCount) homeCap.append(right);
    homeMenuOpen = false;
}

function homeChip(icon, text, onClick, cls = '') {
    const b = homeBtn('home-chip' + (cls ? ' ' + cls : ''), icon, null, onClick);
    b.append(makeEl('span', '', text));
    return b;
}

function renderChips(s) {
    const chips = [];
    if (!s.goal) chips.push(homeChip('clock', 'Set a daily goal', openGoalEditor));
    else if (s.goal.reached) chips.push(homeChip('check', `Goal reached · ${s.goal.done}`, () => showTab('stats'), 'reached'));
    else if (s.goal.rest) chips.push(homeChip('clock', `${s.goal.done} today · rest day`, () => showTab('stats')));
    else chips.push(homeChip('clock', `${s.goal.done} of ${s.goal.of} today`, () => showTab('stats')));
    if (s.streak > 0) chips.push(homeChip('flame', `${s.streak} day streak`, () => showTab('stats')));
    if (s.left > 0) chips.push(homeChip('check', `${s.left} ${s.left === 1 ? 'task' : 'tasks'} left`, () => showTab('todo')));
    if (s.coming) {
        const k = s.coming.date;
        const c = homeChip('cal', '', () => { selectDay(k); showTab('calendar'); });
        c.lastChild.append(makeEl('span', 'hc-chip-task', s.coming.text), `, ${s.coming.label}`);
        c.title = `${s.coming.text}, ${dueLabel({ date: k })}`;
        chips.push(c);
    }
    homeChips.replaceChildren(...chips);
}

// Redraws only when something shown changes (the time left is updated in place), so buttons keep focus
function renderHome(force) {
    const d = new Date();
    homeDate.textContent = `${HOME_DAYS[d.getDay()]}, ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}`;
    if (!homeOpen()) return;
    const s = homeState();
    const sig = JSON.stringify(s);
    if (homeTimeEl) homeTimeEl.textContent = `${format(remaining)} left`;
    if (!force && sig === homeSig) return;
    if (!force && homeMenuOpen) return;   // not while the duration menu is open
    homeSig = sig;
    renderCapsule(s);
    renderChips(s);
}

// Called by showTab() when Home opens or closes
function onHomeTab() {
    syncHomeBg();
    if (homeOpen()) renderHome(true);
    else homeMenu(false);
}

setInterval(() => {
    if (homeOpen()) syncHomeBg();   // follows Animations and the scene if they change
    renderHome(false);
}, 500);
