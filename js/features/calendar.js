// Clockus — Calendar tab: the month on the left, the selected day on the right
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// A task can have a day: t.date = 'YYYY-MM-DD' (no time). To do stays the one list; a day puts a task in the calendar.
// The day is saved with the task in localStorage, in the `due_date` column of `tasks` and in user_settings.data.plan
// (the plan carries the time of each change, so the newest change wins between devices).
// Older versions could also give a task a time and a length (t.time, t.dur): they are kept and synced, but not shown.

// ---------- Dates as 'YYYY-MM-DD' keys ----------
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SNAP_MIN = 15;
const DEFAULT_DUR = 30;

const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
const addMonths = (k, n) => { const d = keyToDate(k); return dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)); };
const monthOf = (k) => k.slice(0, 8) + '01';
const mondayOf = (k) => addDays(k, -((keyToDate(k).getDay() + 6) % 7));
const isDayKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(keyToDate(s));
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isOverdue = (t) => !t.done && !!t.date && t.date < dayKey();
const clockTime = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

// Short label for a task's day, as on the chips: "Today", "Tomorrow", "Fri 20", "3 Dec", "3 Dec 2027"
function dueLabel(t) {
    if (!t.date) return '';
    const d = keyToDate(t.date);
    const diff = Math.round((d - keyToDate(dayKey())) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (Math.abs(diff) < 7) return `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()}`;
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
}

// ---------- Plan: the day of every task (and the time / length kept from older versions) ----------
function setPlanFields(t, entry) {
    const [date, time, dur] = Array.isArray(entry) ? entry : [];
    if (isDayKey(date)) t.date = date; else delete t.date;
    if (t.date && isTime(time)) t.time = time; else delete t.time;
    if (t.time && Number(dur) >= SNAP_MIN) t.dur = clamp(dur, SNAP_MIN, 720); else delete t.dur;
}

// Compact form for syncing: { id: [date, time, minutes, changed at] }. Every task is listed, also the
// ones without a day, so "no day" is a choice the other devices see (newest change wins).
function planMap() {
    const plan = {};
    tasks.forEach((t) => { plan[t.id] = [t.date || '', t.time || '', t.dur || 0, t.pAt || 0]; });
    return plan;
}

// Merges the plan saved by another device: for each task, the newest change wins.
// legacyIds: tasks the cloud knew in an older format without times of change (their missing entry = no day).
function mergePlan(remotePlan, legacyIds) {
    tasks.forEach((t) => {
        const e = remotePlan && remotePlan[t.id];
        const rAt = e ? Number(e[3]) || 0 : legacyIds.has(t.id) ? 0 : -1;
        if (rAt < 0 || rAt < (t.pAt || 0)) return;   // the cloud never saw it, or this device changed it later
        setPlanFields(t, e);
        t.pAt = rAt;
    });
}

// Gives a task a day, or takes it away (date null). Saved here, in the task's row and in the plan.
function planTask(t, date) {
    setPlanFields(t, [date, t.time, t.dur]);
    t.pAt = Date.now();
    renderTasks();       // saves and redraws the To do list and the calendar
    cloudUpsert(t);
    pushSettings();
}

function addTaskOn(text, date) {
    text = text.trim().slice(0, 120);
    if (!text) return null;
    const task = { id: Date.now(), text, done: false, doneOn: null, pAt: Date.now() };
    setPlanFields(task, [date]);
    tasks.push(task);
    renderTasks();
    cloudUpsert(task);
    pushSettings();
    return task;
}

// Focus sessions of a day (used by the goals)
function sessionsOn(k) {
    return sessions
        .filter((s) => s.e - s.s >= 60000 && dayKey(new Date(s.s)) === k)
        .sort((a, b) => a.s - b.s);
}

// ---------- Elements and state ----------
const calTitle = $('cal-title');
const calPrev = $('cal-prev');
const calNext = $('cal-next');
const calTodayBtn = $('cal-today');
const calGrid = $('cal-grid');
const calOverdue = $('cal-overdue');
const calOverdueList = $('cal-overdue-list');
const dayTitle = $('day-title');
const dayDate = $('day-date');
const dayEmpty = $('day-empty');
const dayTasks = $('day-tasks');
const dayForm = $('day-add');
const dayInput = $('day-input');
const dayPickBtn = $('day-pick-btn');
const dayPick = $('day-pick');
const dayPickList = $('day-pick-list');
const dayFocus = $('day-focus');

let calSel = dayKey();                 // the selected day
let calMonth = monthOf(calSel);        // the month shown
let calTimer = null;
// Month or List (Upcoming): the last view used is remembered on this device (key `calView`)
let calView = store.get('calView', 'month') === 'list' ? 'list' : 'month';
const calViewBtns = document.querySelectorAll('[data-cal-view]');
const GRIP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

function setCalView(v) {
    calView = v === 'list' ? 'list' : 'month';
    store.set('calView', calView);
    renderCalendar();
}

function tasksOn(k) {
    // Open tasks first (the top priority one on top), then done ones; To do order inside each group
    const list = tasks.filter((t) => t.date === k);
    return [...list.filter((t) => !t.done && t.id === topPriorityId), ...list.filter((t) => !t.done && t.id !== topPriorityId), ...list.filter((t) => t.done)];
}

// ---------- Render ----------
function calendarOpen() { return document.body.dataset.tab === 'calendar'; }

// Called when tasks change
function refreshCalendar() {
    if (calendarOpen()) renderCalendar();
}

// Called on every focus tick: redraw at most once a second
function renderCalendarSoon() {
    if (!calendarOpen() || calTimer) return;
    calTimer = setTimeout(() => {
        calTimer = null;
        if (document.body.classList.contains('mv-dragging')) return;   // not under a task being dragged
        renderCalendar();
    }, 1000);
}

// Wide screens: the month card fills the page height, from where it starts down to the page's bottom margin, so the
// page does not scroll for nothing. The CSS uses it only above 900px (app.css, --cal-fill).
const calCard = calContainerEl.querySelector('.cal-card');
function sizeCalCard() {
    if (document.body.dataset.tab !== 'calendar' || calView === 'list') return;
    const top = calCard.getBoundingClientRect().top + window.scrollY;
    const bottom = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    const fill = Math.floor(document.documentElement.clientHeight - top - bottom);
    document.documentElement.style.setProperty('--cal-fill', `${Math.max(0, fill)}px`);
}
window.addEventListener('resize', sizeCalCard);

function renderCalendar() {
    calContainerEl.dataset.view = calView;
    press(calViewBtns, (b) => b.dataset.calView === calView);
    if (calView === 'list') { renderList(); return; }   // calendar-list.js
    sizeCalCard();
    const todayK = dayKey();
    const d = keyToDate(calMonth);
    calTitle.replaceChildren(`${CAL_MONTHS[d.getMonth()]} `, makeEl('span', 'cal-year', String(d.getFullYear())));
    renderMonth(todayK);
    renderDay(todayK);
}

function renderMonth(todayK) {
    const start = mondayOf(calMonth);
    const month = keyToDate(calMonth).getMonth();
    calGrid.replaceChildren();
    for (let i = 0; i < 42; i++) {
        const k = addDays(start, i);
        const d = keyToDate(k);
        const inMonth = d.getMonth() === month;
        if (i >= 28 && i % 7 === 0 && !inMonth) break;   // no empty last row

        const list = tasks.filter((t) => t.date === k);
        const done = list.filter((t) => t.done).length;
        const cell = makeEl('button', 'cal-cell' + (inMonth ? '' : ' out') + (k === todayK ? ' today' : '') + (k === calSel ? ' sel' : ''));
        cell.type = 'button';
        cell.dataset.day = k;
        cell.setAttribute('aria-pressed', String(k === calSel));
        if (k === todayK) cell.setAttribute('aria-current', 'date');
        cell.setAttribute('aria-label', `${CAL_DAY_FULL[d.getDay()]} ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}`
            + (list.length ? `, ${list.length} ${list.length === 1 ? 'task' : 'tasks'}, ${done} done` : ''));
        cell.append(makeEl('span', 'cal-num', String(d.getDate())));
        // One dot per task (at most three): open ones in the accent color, done ones grey
        const dots = makeEl('span', 'cal-dots');
        [...list.filter((t) => !t.done), ...list.filter((t) => t.done)].slice(0, 3)
            .forEach((t) => dots.append(makeEl('i', 'dot' + (t.done ? ' done' : ''))));
        cell.append(dots);
        calGrid.append(cell);
    }
}

// One task row in the day panel (also used for the overdue and the "pick" lists)
function dayRow(t, opts = {}) {
    const top = !t.done && t.id === topPriorityId;
    const li = makeEl('li', 'day-item' + (t.done ? ' done' : '') + (top ? ' top' : '') + (opts.pick ? ' pick' : ''));
    li.dataset.id = t.id;
    if (opts.pick) {
        // Tap the whole row to put the task on the selected day
        const b = makeEl('button', 'day-pick-item');
        b.type = 'button';
        b.append(makeEl('span', 'day-circle'), makeEl('span', 'day-text', t.text));
        b.setAttribute('aria-label', `Put ${t.text} on this day`);
        li.append(b);
        return li;
    }
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = t.done;
    label.append(cb, makeEl('span', 'day-text', t.text));
    // The grip: drag the task onto another day, or click it (keyboard, touch) for the "Move to…" sheet (calendar-move.js)
    let grip = null;
    if (opts.grip && !t.done) {
        grip = makeEl('button', 'mv-grip');
        grip.type = 'button';
        grip.innerHTML = GRIP_ICON;   // fixed markup, no user text
        grip.title = 'Drag to another day, or click to move';
        grip.setAttribute('aria-label', `Move ${t.text} to another day`);
        grip.setAttribute('aria-haspopup', 'dialog');
    }
    if (grip && opts.gripFirst) li.append(grip);
    li.append(label);
    if (opts.chip) li.append(makeEl('span', 'day-chip', dueLabel(t)));
    if (top) {
        const flag = makeEl('span', 'day-flag');
        flag.innerHTML = FLAG_ICON;   // fixed markup, no user text
        flag.title = 'Top priority';
        li.append(flag);
    }
    if (grip && !opts.gripFirst) li.append(grip);
    return li;
}

function renderDay(todayK) {
    const d = keyToDate(calSel);
    const diff = Math.round((d - keyToDate(todayK)) / 86400000);
    const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : '';
    const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
    const full = `${CAL_DAY_FULL[d.getDay()]}, ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}${year}`;
    // "Today" + the date under it; other days: the date is the title. On a phone: "Today · 15 Nov"
    dayTitle.textContent = rel || full;
    dayDate.replaceChildren(makeEl('span', 'day-date-long', rel ? full : ''),
        makeEl('span', 'day-date-short', rel ? `· ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` : ''));

    const list = tasksOn(calSel);

    // Overdue: one quiet line and one button, only on today
    const late = calSel === todayK ? tasks.filter(isOverdue) : [];
    calOverdue.hidden = !late.length;
    calOverdueList.replaceChildren(...late.map((t) => dayRow(t, { chip: true, grip: true })));
    $('cal-overdue-text').textContent = `${late.length} ${late.length === 1 ? 'task' : 'tasks'} from earlier days`;

    // Empty day: one line and one action, nothing else
    const empty = !list.length;
    dayEmpty.hidden = !empty;
    dayEmpty.textContent = calSel < todayK ? 'Nothing was planned.' : 'Nothing planned for this day.';
    // An empty day from today on: "Add a task for this day" stands out a little more (the first step)
    $('day-add').classList.toggle('prominent', empty && calSel >= todayK);
    dayTasks.replaceChildren(...list.map((t) => dayRow(t, { grip: true })));

    // Pick from To do: the open tasks without a day
    const undated = tasks.filter((t) => !t.done && !t.date);
    dayPickBtn.hidden = empty || !undated.length;
    if (dayPickBtn.hidden || !undated.length) setPick(false);
    dayPickList.replaceChildren(...undated.map((t) => dayRow(t, { pick: true })));

    // Focus time of the day: one line; the full picture is in Stats
    const ms = totalsByDay()[calSel] || 0;
    dayFocus.hidden = empty || (ms < 60000 && calSel !== todayK);
    dayFocus.textContent = ms >= 60000
        ? `${fmtDuration(ms)} of focus ${calSel === todayK ? 'today' : 'this day'}`
        : 'No focus yet today';
}

function setPick(open) {
    dayPick.hidden = !open;
    dayPickBtn.setAttribute('aria-expanded', String(open));
    dayPickBtn.classList.toggle('on', open);
}

// ---------- Navigation inside the calendar ----------
function selectDay(k) {
    if (k !== calSel) setPick(false);
    calSel = k;
    calMonth = monthOf(k);
    renderCalendar();
}

function calStep(dir) {
    if (calView === 'list') return;   // the arrows (and ← →) belong to the month
    setPick(false);
    calMonth = addMonths(calMonth, dir);
    // keep the selection inside the month you are looking at
    const want = keyToDate(calSel).getDate();
    const last = keyToDate(addDays(addMonths(calMonth, 1), -1)).getDate();
    calSel = calMonth.slice(0, 8) + pad2(Math.min(want, last));
    renderCalendar();
}

function calToday() {
    selectDay(dayKey());
}

calViewBtns.forEach((b) => b.addEventListener('click', () => setCalView(b.dataset.calView)));
calPrev.addEventListener('click', () => calStep(-1));
calNext.addEventListener('click', () => calStep(1));
calTodayBtn.addEventListener('click', calToday);

calGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-cell');
    if (cell) selectDay(cell.dataset.day);
});

$('cal-overdue-btn').addEventListener('click', () => {
    const k = dayKey();
    const late = tasks.filter(isOverdue);
    late.forEach((t) => { setPlanFields(t, [k, t.time, t.dur]); t.pAt = Date.now(); });
    renderTasks();
    late.forEach(cloudUpsert);
    pushSettings();
});

dayForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addTaskOn(dayInput.value, calSel)) dayInput.value = '';
});

dayPickBtn.addEventListener('click', () => setPick(dayPick.hidden));

dayPickList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (t) planTask(t, calSel);
});

// Ticking a task here ticks it everywhere (same task as in To do)
[dayTasks, calOverdueList].forEach((ul) => ul.addEventListener('change', (e) => {
    const li = e.target.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (t && e.target.type === 'checkbox') setTaskDone(t, e.target.checked);
}));

// New day while the tab is open: "today" and overdue tasks move on
setInterval(() => { if (calendarOpen()) renderCalendar(); }, 60000);
