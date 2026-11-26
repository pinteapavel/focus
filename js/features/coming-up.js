// Clockus — "Coming up": a look at the day's tasks, in the same spot, with the same ring and fade as the top priority reminder
// Loaded as a classic script (shared global scope). Load order is set in app.html (after reminders.js).
//
// Three kinds, each at most once a day:
// - Morning summary: today's tasks, the first time you open Clockus that day, or from 08:00.
// - Evening lookahead: tomorrow's tasks, from 20:00 or 21:00.
// - Overdue reminder: only when tasks were left behind on earlier days.
// Never stacked: while one card is on screen the other waits for it to fade. Both wait while a focus session runs.
// Nothing planned: nothing is shown. Shown inside the page only (while a Clockus tab is open).

// ---------- Settings (this device only, key `comingUp`) ----------
const CU_MORNING = ['open', '08:00', 'off'];
const CU_EVENING = ['20:00', '21:00', 'off'];
const CU_DEFAULTS = { morning: 'open', evening: '20:00', overdue: true };

function cleanComingUp(c) {
    const x = Object.assign({}, CU_DEFAULTS, c && typeof c === 'object' ? c : {});
    if (!CU_MORNING.includes(x.morning)) x.morning = CU_DEFAULTS.morning;
    if (!CU_EVENING.includes(x.evening)) x.evening = CU_DEFAULTS.evening;
    x.overdue = x.overdue !== false;
    return { morning: x.morning, evening: x.evening, overdue: x.overdue };
}

let comingUp = cleanComingUp(store.get('comingUp', null));
const cuMorningBtns = document.querySelectorAll('[data-cu-morning]');
const cuEveningBtns = document.querySelectorAll('[data-cu-evening]');
const cuOverdue = $('cu-overdue');

function renderComingUpSettings() {
    press(cuMorningBtns, (b) => b.dataset.cuMorning === comingUp.morning);
    press(cuEveningBtns, (b) => b.dataset.cuEvening === comingUp.evening);
    cuOverdue.checked = comingUp.overdue;
}

function changeComingUp(key, value) {
    comingUp[key] = value;
    comingUp = cleanComingUp(comingUp);
    store.set('comingUp', comingUp);
    renderComingUpSettings();
}

cuMorningBtns.forEach((b) => b.addEventListener('click', () => changeComingUp('morning', b.dataset.cuMorning)));
cuEveningBtns.forEach((b) => b.addEventListener('click', () => changeComingUp('evening', b.dataset.cuEvening)));
cuOverdue.addEventListener('change', () => changeComingUp('overdue', cuOverdue.checked));

// ---------- The toast (js/core/toast.js) ----------
let cuToast = null;   // the toast on screen, if any

// Read by reminders.js: the top priority reminder waits while this one is on screen
const comingUpVisible = () => !!(cuToast && cuToast.isOpen());

// "Coming up · Today · 3 tasks today", then the task names. Shown as long as the reminder (Settings: 5, 8 or 12 s).
// A click opens that day in the Calendar.
function showComingUp(c) {
    if (cuToast) cuToast.close();
    const open = () => { showTab('calendar'); if (c.day) selectDay(c.day); };
    cuToast = showToast({
        type: 'info',
        id: 'coming-up',
        title: `${c.label} · ${c.title}`,
        text: c.sub,
        duration: reminders.show * 1000,
        label: `${c.label}: ${c.title}. ${c.sub}. Open Calendar`,
        onClick: open,
        action: { label: 'Open', run: open }
    });
    chime();
}

// ---------- What each kind says (null: nothing to say, so it stays quiet) ----------
function comingUpContent(kind) {
    const todayK = dayKey();
    const names = (list) => list.map((t) => t.text).join(', ');
    const count = (n) => `${n} ${n === 1 ? 'task' : 'tasks'}`;
    if (kind === 'morning' || kind === 'evening') {
        const k = kind === 'morning' ? todayK : addDays(todayK, 1);
        const list = tasksOn(k).filter((t) => !t.done);
        if (!list.length) return null;
        const when = kind === 'morning' ? 'today' : 'tomorrow';
        return { label: `Coming up · ${kind === 'morning' ? 'Today' : 'Tomorrow'}`, title: `${count(list.length)} ${when}`, sub: names(list), day: k };
    }
    const late = tasks.filter(isOverdue);
    if (!late.length) return null;
    return { label: 'Coming up · Earlier', title: `${count(late.length)} from earlier days`, sub: 'They wait in your Calendar', day: todayK };
}

// Is the kind due now? (its time has come, and it was not shown yet today)
function comingUpDue(kind, last) {
    const todayK = dayKey();
    if (last[kind] === todayK) return false;
    const now = new Date();
    const hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    if (kind === 'morning') return comingUp.morning === 'open' || (comingUp.morning !== 'off' && hm >= comingUp.morning);
    if (kind === 'evening') return comingUp.evening !== 'off' && hm >= comingUp.evening;
    return comingUp.overdue;
}

// The first seconds after opening: tasks from the cloud may still be on their way
const cuStartedAt = Date.now();
const CU_SETTLE_MS = 6000;

setInterval(() => {
    if (Date.now() - cuStartedAt < CU_SETTLE_MS) return;
    if (comingUpVisible() || reminderVisible()) return;           // one at a time, never stacked
    if (document.visibilityState !== 'visible') return;
    if (running && mode === 'focus') return;                       // waits while a focus session is running
    // When each kind was last shown (shared by the tabs of this browser, so only one of them shows it)
    const last = Object.assign({}, store.get('comingUpLast', null) || {});
    for (const kind of ['morning', 'overdue', 'evening']) {
        if (!comingUpDue(kind, last)) continue;
        const c = comingUpContent(kind);
        // Nothing planned: stay quiet. Morning and evening count as done for the day; the overdue one
        // keeps watching (tasks left behind can still arrive from another device today).
        if (!c && kind === 'overdue') continue;
        last[kind] = dayKey();
        store.set('comingUpLast', last);
        if (c) { showComingUp(c); return; }
    }
}, 5000);

// Other tabs of this browser: same settings
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.key !== 'comingUp') return;
    comingUp = cleanComingUp(store.get('comingUp', null));
    renderComingUpSettings();
});

renderComingUpSettings();
