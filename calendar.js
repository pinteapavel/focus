// Clockus — Calendar tab: month grid, selected day, week planner, overdue tasks, .ics export
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// A task can have a day and, optionally, a time and a length:
//   t.date = 'YYYY-MM-DD'   t.time = 'HH:MM'   t.dur = minutes (only with a time)
// These are saved with the task in localStorage and synced in user_settings.data.plan.

// ---------- Dates as 'YYYY-MM-DD' keys ----------
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_START_H = 6;          // the week grid shows 06:00 ...
const WEEK_END_H = 24;           // ... to midnight
const HOUR_PX = 52;              // height of one hour in the week grid
const SNAP_MIN = 15;
const DEFAULT_DUR = 30;

const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
const addMonths = (k, n) => { const d = keyToDate(k); return dayKey(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)); };
const monthOf = (k) => k.slice(0, 8) + '01';
const mondayOf = (k) => addDays(k, -((keyToDate(k).getDay() + 6) % 7));
const isDayKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(keyToDate(s));
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
const isOverdue = (t) => !t.done && !!t.date && t.date < dayKey();

// Short label for a task's day: "Today", "Tomorrow 15:00", "13 Nov"
function dueLabel(t) {
    if (!t.date) return '';
    const diff = Math.round((keyToDate(t.date) - keyToDate(dayKey())) / 86400000);
    const d = keyToDate(t.date);
    const name = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
        : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
    return t.time ? `${name} ${t.time}` : name;
}

// ---------- Plan: the day / time / length of every task ----------
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

function planTask(t, date, time, dur) {
    setPlanFields(t, [date, time, dur]);
    t.pAt = Date.now();
    renderTasks();       // saves and redraws the To do list and the calendar
    pushSettings();
}

function addTaskOn(text, date, time, dur) {
    text = text.trim().slice(0, 120);
    if (!text) return null;
    const task = { id: Date.now(), text, done: false, doneOn: null, pAt: Date.now() };
    setPlanFields(task, [date, time, time ? dur || DEFAULT_DUR : 0]);
    tasks.push(task);
    renderTasks();
    cloudUpsert(task);
    pushSettings();
    return task;
}

// ---------- Elements and state ----------
const calTitle = $('cal-title');
const calPrev = $('cal-prev');
const calNext = $('cal-next');
const calTodayBtn = $('cal-today');
const calViewBtns = document.querySelectorAll('[data-cal-view]');
const calMonthPanel = $('cal-month');
const calWeekPanel = $('cal-week');
const calGrid = $('cal-grid');
const calMonthTotal = $('cal-month-total');
const weekWrap = $('week-wrap');
const weekGrid = $('week-grid');
const weekTotal = $('week-total');
const calOverdue = $('cal-overdue');
const dayTitle = $('day-title');
const dayTasks = $('day-tasks');
const dayForm = $('day-add');
const dayInput = $('day-input');
const dayWhenBtn = $('day-when');
const dayStats = $('day-stats');
const dayLine = $('day-line');
const dayFree = $('day-free');
const daySessions = $('day-sessions');
const calUnscheduled = $('cal-unscheduled');
const calExport = $('cal-export');

let calView = store.get('calView', 'month') === 'week' ? 'week' : 'month';
let calSel = dayKey();                 // the selected day
let calMonth = monthOf(calSel);        // the month shown in the month view
let calTimer = null;
let calDrag = null;
let calSuppressClick = false;
let weekScrollPending = true;
// When the next task added from the day panel is planned (date null = the selected day)
let dayWhen = { date: null, time: null, dur: DEFAULT_DUR };

const CLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const fmtLen = (n) => (n < 60 ? `${n}m` : n % 60 ? `${Math.floor(n / 60)}h${pad2(n % 60)}` : `${n / 60}h`);

function tasksByDay() {
    const byDay = {};
    tasks.forEach((t) => { if (t.date) (byDay[t.date] || (byDay[t.date] = [])).push(t); });
    // Tasks with a time first, in time order; then the rest, in To do order
    for (const list of Object.values(byDay)) {
        list.sort((a, b) => (a.time ? toMin(a.time) : 1e4) - (b.time ? toMin(b.time) : 1e4));
    }
    return byDay;
}

function sessionsOn(k) {
    return sessions
        .filter((s) => s.e - s.s >= 60000 && dayKey(new Date(s.s)) === k)
        .sort((a, b) => a.s - b.s);
}

function sessionName(s) {
    const t = tasks.find((x) => x.id === s.t);
    return (t && t.text) || s.x || 'Focus';
}

const clockTime = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

// ---------- Render ----------
function calendarOpen() { return document.body.dataset.tab === 'calendar'; }

// Called when tasks change: redraw now (but never in the middle of a drag)
function refreshCalendar() {
    if (calendarOpen() && !calDrag) renderCalendar();
}

// Called on every focus tick: redraw at most once a second
function renderCalendarSoon() {
    if (!calendarOpen() || calTimer) return;
    calTimer = setTimeout(() => {
        calTimer = null;
        if (calDrag) renderCalendarSoon();
        else renderCalendar();
    }, 1000);
}

function renderCalendar() {
    const totals = totalsByDay();
    const todayK = dayKey();
    const byDay = tasksByDay();

    if (calView === 'month') {
        const d = keyToDate(calMonth);
        calTitle.textContent = `${CAL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        calPrev.setAttribute('aria-label', 'Previous month');
        calNext.setAttribute('aria-label', 'Next month');
    } else {
        const mon = keyToDate(mondayOf(calSel));
        const sun = keyToDate(addDays(mondayOf(calSel), 6));
        calTitle.textContent = mon.getMonth() === sun.getMonth()
            ? `${mon.getDate()} – ${sun.getDate()} ${CAL_MONTHS[sun.getMonth()]} ${sun.getFullYear()}`
            : `${mon.getDate()} ${MONTH_NAMES[mon.getMonth()]} – ${sun.getDate()} ${MONTH_NAMES[sun.getMonth()]} ${sun.getFullYear()}`;
        calPrev.setAttribute('aria-label', 'Previous week');
        calNext.setAttribute('aria-label', 'Next week');
    }
    calViewBtns.forEach((b) => {
        const on = b.dataset.calView === calView;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
    });
    calMonthPanel.hidden = calView !== 'month';
    calWeekPanel.hidden = calView !== 'week';

    renderOverdue();
    if (calView === 'month') renderMonth(totals, byDay, todayK);
    else renderWeek(totals, byDay, todayK);
    renderDay(totals, byDay, todayK);
    renderUnscheduled();
    calExport.disabled = !tasks.some((t) => t.date);
}

function renderOverdue() {
    const late = tasks.filter(isOverdue);
    calOverdue.hidden = !late.length;
    if (late.length) {
        $('cal-overdue-text').textContent = `${late.length} overdue ${late.length === 1 ? 'task' : 'tasks'}`;
    }
}

function renderMonth(totals, byDay, todayK) {
    const start = mondayOf(calMonth);
    const month = keyToDate(calMonth).getMonth();
    let monthMs = 0;
    calGrid.replaceChildren();
    for (let i = 0; i < 42; i++) {
        const k = addDays(start, i);
        const d = keyToDate(k);
        const inMonth = d.getMonth() === month;
        if (i >= 28 && i % 7 === 0 && !inMonth) break;   // no empty last row

        const ms = totals[k] || 0;
        if (inMonth) monthMs += ms;
        const list = byDay[k] || [];
        const done = list.filter((t) => t.done).length;

        const hitGoal = goals && goalReachedOn(k, totals);
        const cell = makeEl('button', 'cal-cell' + (inMonth ? '' : ' out') + (k === todayK ? ' today' : '') + (k === calSel ? ' sel' : ''));
        cell.type = 'button';
        cell.dataset.day = k;
        cell.setAttribute('aria-pressed', String(k === calSel));
        if (k === todayK) cell.setAttribute('aria-current', 'date');
        cell.setAttribute('aria-label', `${CAL_DAY_FULL[d.getDay()]} ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}`
            + (list.length ? `, ${list.length} ${list.length === 1 ? 'task' : 'tasks'}, ${done} done` : '')
            + (ms >= 60000 ? `, ${fmtDuration(ms)} focus` : '')
            + (hitGoal ? ', daily goal reached' : ''));

        const num = makeEl('span', 'cal-num', String(d.getDate()));
        if (hitGoal) {
            const mark = makeEl('i', 'cal-goal');
            mark.title = 'Daily goal reached';
            num.append(mark);
        }
        cell.append(num);
        const dots = makeEl('span', 'cal-dots');
        list.slice(0, 3).forEach((t) => dots.append(makeEl('i', 'dot' + (t.done ? ' done' : t.date < todayK ? ' late' : ''))));
        if (list.length > 3) dots.append(makeEl('span', 'dot-more', `+${list.length - 3}`));
        cell.append(dots);
        const track = makeEl('span', 'cal-track');
        if (ms >= 60000) {
            const b = makeEl('span', `cal-bar l${Math.max(1, Math.min(4, Math.floor(ms / HOUR_MS)))}`);
            b.style.width = `${Math.max(12, Math.min(100, (ms / (4 * HOUR_MS)) * 100))}%`;
            track.append(b);
        }
        cell.append(track);
        calGrid.append(cell);
    }
    calMonthTotal.textContent = `Focus this month: ${fmtDuration(monthMs)}`;
}

// Side by side lanes for blocks that overlap in time
function layoutLanes(items) {
    let cluster = [];
    let laneEnds = [];
    let clusterEnd = -1;
    const flush = () => { cluster.forEach((it) => { it.lanes = laneEnds.length; }); cluster = []; laneEnds = []; };
    items.forEach((it) => {
        if (it.start >= clusterEnd) flush();
        let lane = laneEnds.findIndex((end) => end <= it.start);
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
        it.lane = lane;
        cluster.push(it);
        clusterEnd = Math.max(clusterEnd, it.end);
    });
    flush();
}

const minToPx = (m) => ((m - WEEK_START_H * 60) / 60) * HOUR_PX;
const gridHeight = () => (WEEK_END_H - WEEK_START_H) * HOUR_PX;

function renderWeek(totals, byDay, todayK) {
    const mon = mondayOf(calSel);
    weekGrid.replaceChildren();
    weekGrid.style.setProperty('--hour', `${HOUR_PX}px`);
    weekGrid.append(makeEl('div', 'wk-corner'));
    for (let j = 0; j < 7; j++) {
        const k = addDays(mon, j);
        const head = makeEl('button', 'wk-head' + (k === todayK ? ' today' : '') + (k === calSel ? ' sel' : ''));
        head.type = 'button';
        head.dataset.day = k;
        head.setAttribute('aria-pressed', String(k === calSel));
        head.append(makeEl('span', '', CAL_DOW[j].toUpperCase()), makeEl('b', '', String(keyToDate(k).getDate())));
        weekGrid.append(head);
    }

    const times = makeEl('div', 'wk-times');
    for (let h = WEEK_START_H; h < WEEK_END_H; h++) times.append(makeEl('span', '', `${pad2(h)}:00`));
    weekGrid.append(times);

    let focusMs = 0;
    let plannedMin = 0;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    for (let j = 0; j < 7; j++) {
        const k = addDays(mon, j);
        focusMs += totals[k] || 0;
        const col = makeEl('div', 'wk-col' + (k === todayK ? ' today' : ''));
        col.dataset.day = k;
        col.style.height = `${gridHeight()}px`;

        // Logged focus sessions: a thin strip on the left of the day
        sessionsOn(k).forEach((s) => {
            const a = new Date(s.s);
            const startMin = a.getHours() * 60 + a.getMinutes();
            const top = Math.max(0, minToPx(startMin));
            const bottom = Math.min(gridHeight(), minToPx(startMin + (s.e - s.s) / 60000));
            if (bottom <= 0 || top >= gridHeight()) return;
            const strip = makeEl('span', 'wk-session');
            strip.style.top = `${top}px`;
            strip.style.height = `${Math.max(3, bottom - top)}px`;
            strip.title = `${clockTime(s.s)} – ${clockTime(s.e)} · ${sessionName(s)}`;
            col.append(strip);
        });

        // Tasks with a time: blocks you can move and stretch
        const items = (byDay[k] || []).filter((t) => t.time).map((t) => {
            const start = toMin(t.time);
            const dur = t.dur || DEFAULT_DUR;
            if (!t.done) plannedMin += dur;
            return { t, start, end: start + dur };
        });
        layoutLanes(items);
        items.forEach(({ t, start, end, lane, lanes }) => {
            const height = Math.max(18, minToPx(end) - minToPx(start) - 2);
            const block = makeEl('div', 'wk-block' + (t.done ? ' done' : '') + (isOverdue(t) ? ' late' : '') + (height < 40 ? ' short' : ''));
            block.dataset.id = t.id;
            const top = Math.max(0, Math.min(gridHeight() - 18, minToPx(start)));
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.style.left = `calc(10px + (100% - 12px) * ${lane / lanes})`;
            block.style.width = `calc((100% - 12px) / ${lanes} - 2px)`;
            block.title = `${t.text} · ${t.time} – ${fromMin(end)}`;
            block.append(makeEl('b', '', t.text), makeEl('span', 'wk-time', `${t.time} – ${fromMin(end)}`), makeEl('span', 'wk-resize'));
            col.append(block);
        });

        if (k === todayK && nowMin >= WEEK_START_H * 60) {
            const line = makeEl('span', 'wk-now');
            line.style.top = `${minToPx(nowMin)}px`;
            col.append(line);
        }
        weekGrid.append(col);
    }
    weekTotal.textContent = `Week total: ${fmtDuration(focusMs)} · planned: ${fmtDuration(plannedMin * 60000)}`;

    if (weekScrollPending) {    // open the week at 08:00
        weekScrollPending = false;
        weekWrap.scrollTop = (8 - WEEK_START_H) * HOUR_PX;
    }
}

function renderDay(totals, byDay, todayK) {
    const d = keyToDate(calSel);
    dayTitle.textContent = `${CAL_DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
        + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
    const diff = Math.round((keyToDate(calSel) - keyToDate(todayK)) / 86400000);
    $('day-label').textContent = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
        : diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
    const list = byDay[calSel] || [];
    const done = list.filter((t) => t.done).length;
    const ss = sessionsOn(calSel);
    const ms = totals[calSel] || 0;
    const plannedMin = list.filter((t) => t.time && !t.done).reduce((a, t) => a + (t.dur || DEFAULT_DUR), 0);

    // Three tiles: focus, sessions, tasks
    const tile = (label, value, sub, pct, cls) => {
        const el = makeEl('div', 'day-tile');
        el.append(makeEl('span', 'day-tile-label', label), makeEl('b', '', value), makeEl('span', 'day-tile-sub', sub));
        const track = makeEl('span', 'day-tile-track');
        const fill = makeEl('span', 'day-tile-fill ' + cls);
        fill.style.width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
        track.append(fill);
        el.append(track);
        return el;
    };
    dayStats.replaceChildren(
        goals && isActiveDay(calSel)
            ? tile('Focus', fmtDuration(ms), ms >= goals.focus * 60000 ? 'goal reached' : `${fmtDuration(goals.focus * 60000 - ms)} to goal`,
                ms / (goals.focus * 60000), 'session')
            : tile('Focus', fmtDuration(ms), goals ? 'rest day' : ms >= HOUR_MS ? 'streak day' : `${fmtDuration(HOUR_MS - ms)} to 1h`,
                ms / (4 * HOUR_MS), `l${Math.max(1, Math.min(4, Math.floor(ms / HOUR_MS)))}`),
        tile('Sessions', String(ss.length), ss.length ? `longest ${fmtDuration(Math.max(...ss.map((s) => s.e - s.s)))}` : 'none yet',
            ss.length / 8, 'session'),
        tile('Tasks', list.length ? `${done}/${list.length}` : '0',
            plannedMin ? `${fmtDuration(plannedMin * 60000)} planned` : list.length ? 'no times set' : 'free day',
            list.length ? done / list.length : 0, 'tasks')
    );

    // Free time hint, only for today and later days
    const free = calSel >= todayK ? nextFreeSlot(calSel, dayWhen.dur, null) : null;
    dayFree.hidden = !free;
    if (free) {
        dayFree.textContent = `Next free: ${free}`;
        dayFree.dataset.time = free;
        dayFree.title = `Plan the next task at ${free}`;
    }

    dayTasks.replaceChildren();
    if (!list.length) {
        dayTasks.append(makeEl('li', 'todo-empty', calSel < todayK
            ? 'Nothing was planned for this day.'
            : 'Nothing planned yet. Add a task below or drag one here.'));
    }
    list.forEach((t) => {
        const late = isOverdue(t);
        const li = makeEl('li', 'todo-item day-item' + (t.done ? ' done' : '') + (late ? ' late' : '') + (t.id === currentTaskId ? ' current' : ''));
        li.dataset.id = t.id;
        li.dataset.dragId = t.id;
        const handle = makeEl('span', 'drag-handle', '⠿');
        handle.title = 'Drag onto another day';
        handle.setAttribute('aria-hidden', 'true');

        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.done;
        const textBox = makeEl('span', 'day-item-text');
        textBox.append(makeEl('span', '', t.text), makeEl('small', '',
            t.time ? `${t.time} – ${fromMin(toMin(t.time) + (t.dur || DEFAULT_DUR))} · ${fmtLen(t.dur || DEFAULT_DUR)}`
                : late ? 'Overdue · any time' : 'Any time'));
        label.append(cb, textBox);

        const when = makeEl('button', 'when-chip' + (t.time ? ' set' : ''));
        when.type = 'button';
        if (t.time) when.textContent = t.time;
        else when.innerHTML = CLOCK_ICON;   // fixed markup, no user text
        when.title = 'Change day and time';
        when.setAttribute('aria-label', `Change day and time of ${t.text}`);

        const cur = makeEl('button', 'cur-btn');
        cur.type = 'button';
        cur.innerHTML = CUR_ICON;   // fixed markup, no user text
        cur.disabled = t.done;
        cur.setAttribute('aria-pressed', String(t.id === currentTaskId));
        cur.setAttribute('aria-label', t.id === currentTaskId ? `Stop working on ${t.text}` : `Work on ${t.text}`);
        cur.title = t.id === currentTaskId ? 'Current task' : 'Work on this task';

        const un = makeEl('button', 'unplan-btn', '×');
        un.type = 'button';
        un.title = 'Remove the day (back to Not scheduled)';
        un.setAttribute('aria-label', `Remove the day from ${t.text}`);
        li.append(handle, label, when, cur, un);
        dayTasks.append(li);
    });

    renderDayWhen();
    renderDayLine(list, ss, todayK);

    daySessions.replaceChildren();
    if (!ss.length) {
        daySessions.append(makeEl('li', 'day-empty', ms >= 60000
            ? 'Focus time was counted, but sessions are logged only from the Calendar update on.'
            : calSel > todayK ? 'Sessions appear here when you focus on this day.' : 'No focus sessions logged.'));
    }
    ss.forEach((s) => {
        const li = makeEl('li', 'day-session');
        li.append(makeEl('b', '', sessionName(s)),
            makeEl('span', '', `${clockTime(s.s)} – ${clockTime(s.e)} · ${fmtDuration(s.e - s.s)}`));
        daySessions.append(li);
    });
}

// The day at a glance, 06:00 to 24:00: planned blocks on top, focus sessions below
function renderDayLine(list, ss, todayK) {
    const span = (WEEK_END_H - WEEK_START_H) * 60;
    const pos = (m) => Math.max(0, Math.min(100, ((m - WEEK_START_H * 60) / span) * 100));
    const track = makeEl('div', 'day-line-track');
    list.filter((t) => t.time).forEach((t) => {
        const a = toMin(t.time);
        const seg = makeEl('span', 'day-line-plan' + (t.done ? ' done' : ''));
        seg.style.left = `${pos(a)}%`;
        seg.style.width = `${Math.max(0.8, pos(a + (t.dur || DEFAULT_DUR)) - pos(a))}%`;
        seg.title = `${t.time} · ${t.text}`;
        track.append(seg);
    });
    ss.forEach((s) => {
        const d = new Date(s.s);
        const a = d.getHours() * 60 + d.getMinutes();
        const seg = makeEl('span', 'day-line-focus');
        seg.style.left = `${pos(a)}%`;
        seg.style.width = `${Math.max(0.8, pos(a + (s.e - s.s) / 60000) - pos(a))}%`;
        seg.title = `${clockTime(s.s)} – ${clockTime(s.e)} · ${sessionName(s)}`;
        track.append(seg);
    });
    if (calSel === todayK) {
        const n = new Date();
        const now = makeEl('span', 'day-line-now');
        now.style.left = `${pos(n.getHours() * 60 + n.getMinutes())}%`;
        track.append(now);
    }
    const labels = makeEl('div', 'day-line-labels');
    ['06', '09', '12', '15', '18', '21', '24'].forEach((h) => labels.append(makeEl('span', '', h)));
    dayLine.replaceChildren(track, labels);
    dayLine.setAttribute('aria-label',
        `${list.filter((t) => t.time).length} planned blocks and ${ss.length} focus sessions on this day`);
}

// The chip next to "Add a task": when the new task will be planned
function renderDayWhen() {
    const date = dayWhen.date || calSel;
    const d = keyToDate(date);
    const dayPart = date === calSel ? '' : `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · `;
    const text = dayWhen.noDay ? 'No day'
        : dayPart + (dayWhen.time ? `${dayWhen.time} · ${fmtLen(dayWhen.dur)}` : 'Any time');
    dayWhenBtn.innerHTML = CLOCK_ICON;   // fixed markup
    dayWhenBtn.append(makeEl('span', '', text));
    dayWhenBtn.classList.toggle('set', !!(dayWhen.time || dayWhen.date || dayWhen.noDay));
    dayWhenBtn.setAttribute('aria-label', `When: ${text}. Change`);
}

function renderUnscheduled() {
    const open = tasks.filter((t) => !t.done && !t.date);
    $('un-count').textContent = open.length ? String(open.length) : '';
    calUnscheduled.replaceChildren();
    if (!open.length) {
        calUnscheduled.append(makeEl('li', 'day-empty', 'Every open task has a day.'));
        return;
    }
    const d = keyToDate(calSel);
    const dayName = calSel === dayKey() ? 'today' : `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    open.forEach((t) => {
        const li = makeEl('li', 'un-item');
        li.dataset.dragId = t.id;
        const handle = makeEl('span', 'drag-handle', '⠿');
        handle.setAttribute('aria-hidden', 'true');
        const when = makeEl('button', 'when-chip un-when');
        when.type = 'button';
        when.dataset.id = t.id;
        when.innerHTML = CLOCK_ICON;   // fixed markup
        when.title = 'Choose day and time';
        when.setAttribute('aria-label', `Choose day and time for ${t.text}`);
        const add = makeEl('button', 'un-add', '+');
        add.type = 'button';
        add.dataset.id = t.id;
        add.title = `Plan for ${dayName}`;
        add.setAttribute('aria-label', `Plan ${t.text} for ${dayName}`);
        li.append(handle, makeEl('span', 'un-text', t.text), when, add);
        calUnscheduled.append(li);
    });
}

// ---------- Navigation inside the calendar ----------
function selectDay(k) {
    if (k !== calSel) dayWhen = { date: null, time: null, dur: dayWhen.dur };
    calSel = k;
    calMonth = monthOf(k);
    renderCalendar();
}

function calStep(dir) {
    dayWhen = { date: null, time: null, dur: dayWhen.dur };
    if (calView === 'month') {
        calMonth = addMonths(calMonth, dir);
        // keep the selection inside the month you are looking at
        const want = keyToDate(calSel).getDate();
        const last = keyToDate(addDays(addMonths(calMonth, 1), -1)).getDate();
        calSel = calMonth.slice(0, 8) + pad2(Math.min(want, last));
    } else {
        calSel = addDays(calSel, dir * 7);
        calMonth = monthOf(calSel);
    }
    renderCalendar();
}

function calToday() {
    weekScrollPending = true;
    selectDay(dayKey());
}

function setCalView(view) {
    calView = view;
    store.set('calView', view);
    calMonth = monthOf(calSel);
    if (view === 'week') weekScrollPending = true;
    renderCalendar();
}

// Prepares the "Add a task" form for a given time on the selected day
function planAt(time) {
    dayWhen = { date: null, time, dur: dayWhen.dur || DEFAULT_DUR };
    renderDayWhen();
    dayInput.focus();
}

calPrev.addEventListener('click', () => calStep(-1));
calNext.addEventListener('click', () => calStep(1));
calTodayBtn.addEventListener('click', calToday);
calViewBtns.forEach((b) => b.addEventListener('click', () => setCalView(b.dataset.calView)));
$('day-prev').addEventListener('click', () => selectDay(addDays(calSel, -1)));
$('day-next').addEventListener('click', () => selectDay(addDays(calSel, 1)));

calGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-cell');
    if (cell) selectDay(cell.dataset.day);
});

weekGrid.addEventListener('click', (e) => {
    const head = e.target.closest('.wk-head');
    if (head) return selectDay(head.dataset.day);
    const block = e.target.closest('.wk-block');
    if (block) {
        const t = tasks.find((x) => x.id === Number(block.dataset.id));
        if (t) selectDay(t.date);
        return;
    }
    // Click on an empty slot: plan a block at that time
    const col = e.target.closest('.wk-col');
    if (!col) return;
    const y = e.clientY - col.getBoundingClientRect().top;
    const min = Math.floor((WEEK_START_H * 60 + (y / HOUR_PX) * 60) / 30) * 30;
    selectDay(col.dataset.day);
    planAt(fromMin(Math.min(min, 23 * 60 + 30)));
});

$('plan-block').addEventListener('click', () => {
    const free = nextFreeSlot(calSel >= dayKey() ? calSel : dayKey(), dayWhen.dur || DEFAULT_DUR, null);
    if (calSel < dayKey()) selectDay(dayKey());
    planAt(free || '09:00');
});

dayFree.addEventListener('click', () => planAt(dayFree.dataset.time));

$('cal-overdue-btn').addEventListener('click', () => {
    const k = dayKey();
    tasks.filter(isOverdue).forEach((t) => { t.date = k; t.pAt = Date.now(); });
    renderTasks();
    pushSettings();
});

// Selected day panel
dayWhenBtn.addEventListener('click', () => {
    openPlanPicker(dayWhenBtn, { date: dayWhen.date || calSel, time: dayWhen.time, dur: dayWhen.dur }, (date, time, dur) => {
        // noDay: "No day" was chosen, so the new task goes to Not scheduled
        dayWhen = { date: date && date !== calSel ? date : null, time, dur: dur || dayWhen.dur, noDay: !date };
        renderDayWhen();
        dayInput.focus();
    });
});

dayForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = dayWhen.noDay ? null : dayWhen.date || calSel;
    if (addTaskOn(dayInput.value, date, dayWhen.time, dayWhen.dur)) {
        dayInput.value = '';
        dayWhen = { date: null, time: null, dur: dayWhen.dur };
        renderDayWhen();
    }
});

dayTasks.addEventListener('change', (e) => {
    const li = e.target.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (t && e.target.type === 'checkbox') setTaskDone(t, e.target.checked);
});

dayTasks.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const li = btn && btn.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (!t) return;
    if (btn.classList.contains('unplan-btn')) planTask(t, null);
    else if (btn.classList.contains('cur-btn')) setCurrentTask(currentTaskId === t.id ? null : t.id);
    else if (btn.classList.contains('when-chip')) {
        openPlanPicker(btn, { date: t.date, time: t.time, dur: t.dur, excludeId: t.id },
            (date, time, dur) => planTask(t, date, time, dur));
    }
});

calUnscheduled.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const t = btn && tasks.find((x) => x.id === Number(btn.dataset.id));
    if (!t) return;
    if (btn.classList.contains('un-add')) planTask(t, calSel, null);
    else if (btn.classList.contains('un-when')) {
        openPlanPicker(btn, { date: calSel, excludeId: t.id }, (date, time, dur) => planTask(t, date, time, dur));
    }
});

// ---------- Drag & drop ----------
// place: a task from "Not scheduled" or the day panel onto a day (month) or a time (week)
// move:  a block in the week grid to another time or day
// resize: the bottom edge of a block, to change its length
const calContainer = $('cal-container');

calContainer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const block = e.target.closest('.wk-block');
    const base = { startX: e.clientX, startY: e.clientY, active: false };
    if (block) {
        const t = tasks.find((x) => x.id === Number(block.dataset.id));
        if (!t) return;
        const kind = e.target.closest('.wk-resize') ? 'resize' : 'move';
        calDrag = { ...base, kind, t, el: block, grabY: e.clientY - block.getBoundingClientRect().top, dur: t.dur || DEFAULT_DUR };
        return;
    }
    const item = e.target.closest('[data-drag-id]');
    if (!item) return;
    const onHandle = e.target.closest('.drag-handle');
    const mouseGrab = e.pointerType === 'mouse' && !e.target.closest('input, button, label');
    if (!onHandle && !mouseGrab) return;
    const t = tasks.find((x) => x.id === Number(item.dataset.dragId));
    if (t) calDrag = { ...base, kind: 'place', t, el: item };
});

function snapMin(m) { return Math.round(m / SNAP_MIN) * SNAP_MIN; }

function clearDropMarks() {
    calContainer.querySelectorAll('.drop-on').forEach((x) => x.classList.remove('drop-on'));
}

document.addEventListener('pointermove', (e) => {
    const d = calDrag;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
        if (Math.hypot(dx, dy) < 6) return;
        d.active = true;
        d.el.classList.add('dragging');
        document.body.classList.add('cal-dragging');
        if (d.kind === 'place') {
            d.ghost = makeEl('div', 'cal-ghost', d.t.text);
            document.body.append(d.ghost);
        }
    }
    e.preventDefault();

    if (d.kind === 'resize') {
        const start = toMin(d.t.time);
        const maxDur = WEEK_END_H * 60 - start;
        d.dur = Math.max(SNAP_MIN, Math.min(maxDur, snapMin((d.t.dur || DEFAULT_DUR) + (dy / HOUR_PX) * 60)));
        d.el.style.height = `${Math.max(18, (d.dur / 60) * HOUR_PX - 2)}px`;
        d.el.querySelector('.wk-time').textContent = `${d.t.time} – ${fromMin(start + d.dur)}`;
        return;
    }

    clearDropMarks();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cell = under && under.closest('#cal-container .cal-cell');
    const col = under && under.closest('#cal-container .wk-col');
    d.target = null;

    if (cell) {
        cell.classList.add('drop-on');
        d.target = { day: cell.dataset.day, time: d.t.date ? d.t.time : null };
    } else if (col) {
        const dur = d.t.dur || DEFAULT_DUR;
        const offset = d.kind === 'move' ? d.grabY : 0;
        const y = e.clientY - col.getBoundingClientRect().top - offset;
        const min = Math.max(WEEK_START_H * 60, Math.min(WEEK_END_H * 60 - Math.min(dur, 60), snapMin(WEEK_START_H * 60 + (y / HOUR_PX) * 60)));
        d.target = { day: col.dataset.day, time: fromMin(min) };
        if (d.kind === 'move') {
            if (d.el.parentElement !== col) col.append(d.el);
            d.el.style.top = `${minToPx(min)}px`;
            d.el.style.left = '10px';
            d.el.style.width = 'calc(100% - 12px)';
            d.el.querySelector('.wk-time').textContent = `${fromMin(min)} – ${fromMin(min + dur)}`;
        } else {
            col.classList.add('drop-on');
        }
    }

    if (d.ghost) {
        const dd = d.target && keyToDate(d.target.day);
        d.ghost.textContent = d.target
            ? `${d.t.text} → ${CAL_DOW[(dd.getDay() + 6) % 7]} ${dd.getDate()}${d.target.time ? ' ' + d.target.time : ''}`
            : d.t.text;
        d.ghost.style.left = `${e.clientX + 14}px`;
        d.ghost.style.top = `${e.clientY + 14}px`;
    }
});

function endCalDrag(cancel) {
    const d = calDrag;
    if (!d) return;
    calDrag = null;
    clearDropMarks();
    document.body.classList.remove('cal-dragging');
    d.el.classList.remove('dragging');
    if (d.ghost) d.ghost.remove();
    if (!d.active) return;

    // The click that follows a drag must not count as a click
    calSuppressClick = true;
    setTimeout(() => { calSuppressClick = false; }, 0);

    if (cancel) return renderCalendar();
    if (d.kind === 'resize') return planTask(d.t, d.t.date, d.t.time, d.dur);
    if (!d.target) return renderCalendar();
    const dur = d.t.dur || (d.target.time ? DEFAULT_DUR : 0);
    if (d.kind === 'place' && calView === 'month') calSel = d.target.day;
    planTask(d.t, d.target.day, d.target.time, dur);
}

document.addEventListener('pointerup', () => endCalDrag(false));
document.addEventListener('pointercancel', () => endCalDrag(true));
calContainer.addEventListener('click', (e) => {
    if (calSuppressClick) { e.preventDefault(); e.stopPropagation(); }
}, true);

// ---------- Export to Google / Apple Calendar (.ics) ----------
function exportIcs() {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const local = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clockus//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Clockus'];
    tasks.filter((t) => t.date).forEach((t) => {
        lines.push('BEGIN:VEVENT', `UID:${t.id}@clockus.live`, `DTSTAMP:${stamp}`);
        if (t.time) {
            const start = keyToDate(t.date);
            start.setHours(0, toMin(t.time), 0, 0);
            const end = new Date(start.getTime() + (t.dur || DEFAULT_DUR) * 60000);
            lines.push(`DTSTART:${local(start)}`, `DTEND:${local(end)}`);
        } else {
            lines.push(`DTSTART;VALUE=DATE:${t.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, '')}`);
        }
        lines.push(`SUMMARY:${esc(t.done ? '✓ ' + t.text : t.text)}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clockus.ics';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
calExport.addEventListener('click', exportIcs);

// New day while the tab is open: "today" and overdue tasks move on
setInterval(() => { if (calendarOpen() && !calDrag) renderCalendar(); }, 60000);
