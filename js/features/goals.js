// Clockus — daily and weekly goals: Stats section, editor, the quiet line under the timer, calendar marks
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// goals = { focus: minutes per day, tasks: tasks per day, days: [Mon..Sun] true = active, at: saved ms }
// or null when no goal is set. Saved in localStorage ('goals') and synced in user_settings.data.goals.
// Everything else is worked out from data the app already keeps:
//   focus time -> the focus log, tasks done -> tasks with doneOn, sessions -> the session log.

const GOAL_PRESETS = [60, 120, 180, 240, 360];
const GOAL_DEFAULT = { focus: 180, tasks: 5, days: [true, true, true, true, true, false, false] };
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function cleanGoals(g) {
    if (!g || typeof g !== 'object') return null;
    const days = Array.isArray(g.days) && g.days.length === 7 ? g.days.map(Boolean) : GOAL_DEFAULT.days.slice();
    if (!days.some(Boolean)) days[0] = true;
    return {
        focus: Math.round(clamp(g.focus, 15, 960) / 15) * 15,
        tasks: clamp(g.tasks, 0, 50),
        days,
        at: Number(g.at) || 0
    };
}

let goals = cleanGoals(store.get('goals', null));
let goalWasReached = null;     // to fade the Focus line only at the moment the goal is reached

const fmtGoal = (min) => (min % 60 ? `${Math.floor(min / 60) ? Math.floor(min / 60) + 'h ' : ''}${pad2(min % 60)}m`.replace(/^0/, '') : `${min / 60}h`);
const dowIndex = (k) => (keyToDate(k).getDay() + 6) % 7;           // Monday = 0
const isActiveDay = (k) => !!goals && goals.days[dowIndex(k)];
const activeCount = () => (goals ? goals.days.filter(Boolean).length : 0);
const weeklyGoalMin = () => (goals ? goals.focus * activeCount() : 0);
// One pomodoro = a focus block plus its break: 3h with 25 + 5 minutes is 6 sessions
const sessionGoal = () => (goals ? Math.max(1, Math.round(goals.focus / (settings.focus + settings.brk))) : 0);

function tasksDoneOn(k) {
    const s = keyToDate(k).toDateString();
    return tasks.filter((t) => t.done && t.doneOn === s).length;
}

// A finished pomodoro: a session at least half as long as your focus length
function pomodorosOn(k) {
    return sessionsOn(k).filter((s) => s.e - s.s >= Math.min(settings.focus * 30000, 20 * 60000)).length;
}

function goalReachedOn(k, totals) {
    return isActiveDay(k) && (totals[k] || 0) >= goals.focus * 60000;
}

// ---------- Stats: Goals section ----------
const goalsEmpty = $('goals-empty');
const goalsBody = $('goals-body');
const goalRings = $('goal-rings');
const goalWeek = $('goal-week');
const goalDays = $('goal-days');
const goalTasksWeek = $('goal-tasks-week');

function ringSvg(pct, size, stroke) {
    const r = size / 2 - stroke / 2 - 1;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct));
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
        + `<circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>`
        + (p > 0 ? `<circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"/>` : '')
        + '</svg>';
}

function ringCard({ label, value, of, sub, pct, rest }) {
    const card = makeEl('div', 'goal-card' + (pct >= 1 && !rest ? ' reached' : '') + (rest ? ' rest' : ''));
    const ring = makeEl('div', 'goal-ring');
    ring.innerHTML = ringSvg(rest ? 0 : pct, 96, 7);   // numbers only
    const center = makeEl('span', 'goal-ring-num', rest ? 'rest' : `${Math.round(Math.min(pct, 9.99) * 100)}%`);
    ring.append(center);
    const text = makeEl('div', 'goal-card-text');
    text.append(makeEl('span', 'goal-label', label));
    const val = makeEl('div', 'goal-value', value);
    val.append(makeEl('span', 'goal-of', ` / ${of}`));
    text.append(val, makeEl('span', 'goal-sub', sub));
    card.append(ring, text);
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${label}: ${value} of ${of}. ${sub}`);
    return card;
}

function renderGoals() {
    goalsEmpty.hidden = !!goals;
    goalsBody.hidden = !goals;
    $('goals-edit').hidden = !goals;
    if (!goals) return;

    const totals = totalsByDay();
    const todayK = dayKey();
    const restToday = !isActiveDay(todayK);
    const goalMs = goals.focus * 60000;

    // Today: three rings
    const ms = totals[todayK] || 0;
    const tDone = tasksDoneOn(todayK);
    const sDone = pomodorosOn(todayK);
    const sGoal = sessionGoal();
    const left = goalMs - ms;
    goalRings.replaceChildren(
        ringCard({
            label: 'Focus today', value: fmtDuration(ms), of: fmtGoal(goals.focus), rest: restToday, pct: ms / goalMs,
            sub: restToday ? 'Rest day. Anything counts as a bonus' : left > 0 ? `${fmtDuration(left)} left` : 'Daily goal reached'
        }),
        ringCard({
            label: 'Tasks today', value: String(tDone), of: String(goals.tasks), rest: restToday || !goals.tasks,
            pct: goals.tasks ? tDone / goals.tasks : 0,
            sub: !goals.tasks ? 'No task goal' : tDone >= goals.tasks ? 'All done' : `${goals.tasks - tDone} ${goals.tasks - tDone === 1 ? 'task' : 'tasks'} left`
        }),
        ringCard({
            label: 'Sessions today', value: String(sDone), of: String(sGoal), rest: restToday, pct: sDone / sGoal,
            sub: sDone >= sGoal ? 'Enough pomodoros' : `${sGoal - sDone} more ${sGoal - sDone === 1 ? 'pomodoro' : 'pomodoros'}`
        })
    );

    // This week, Monday first
    const mon = mondayOf(todayK);
    const days = [...Array(7)].map((_, i) => {
        const k = addDays(mon, i);
        return { k, ms: totals[k] || 0, active: goals.days[i], today: k === todayK, future: k > todayK };
    });
    const weekMs = days.reduce((a, d) => a + d.ms, 0);
    const weekGoalMs = weeklyGoalMin() * 60000;
    const remaining = weekGoalMs - weekMs;
    // Days still to come this week that count (today too, if its goal is not reached yet)
    const ahead = days.filter((d) => d.active && (d.future || (d.today && d.ms < goalMs))).length;
    let hint;
    if (remaining <= 0) hint = 'Weekly goal reached. Everything from here is a bonus.';
    else if (!ahead) hint = `${fmtDuration(remaining)} short this week. A fresh week starts Monday.`;
    else if (ahead === 1) hint = `${fmtDuration(remaining)} ${days.find((d) => d.today && d.active) ? 'today' : 'on your next day'} gets you there`;
    else hint = `${fmtDuration(remaining / ahead)} a day for the next ${ahead} days gets you there`;

    // Last week, as a fact
    const lastMon = addDays(mon, -7);
    let lastMs = 0;
    for (let i = 0; i < 7; i++) lastMs += totals[addDays(lastMon, i)] || 0;
    const lastPct = weekGoalMs ? Math.round((lastMs / weekGoalMs) * 100) : 0;

    goalWeek.replaceChildren();
    const head = makeEl('div', 'gw-head');
    const headText = makeEl('div', 'gw-head-text');
    const title = makeEl('div', 'gw-title');
    title.append(makeEl('span', 'goal-label', 'This week'));
    if (lastMs > 0) {
        const last = makeEl('span', 'gw-last' + (lastPct >= 100 ? ' hit' : ''), `last week ${lastPct}%`);
        last.title = `Last week: ${fmtDuration(lastMs)} of ${fmtGoal(weeklyGoalMin())}`;
        title.append(last);
    }
    const big = makeEl('div', 'gw-value', fmtDuration(weekMs));
    big.append(makeEl('span', 'goal-of', ` / ${fmtGoal(weeklyGoalMin())}`));
    headText.append(title, big, makeEl('div', 'goal-sub', hint));
    const ring = makeEl('div', 'goal-ring small' + (remaining <= 0 ? ' reached' : ''));
    ring.innerHTML = ringSvg(weekMs / weekGoalMs, 88, 7);   // numbers only
    ring.append(makeEl('span', 'goal-ring-num', `${Math.round(Math.min(weekMs / weekGoalMs, 9.99) * 100)}%`));
    head.append(headText, ring);
    goalWeek.append(head);

    // Bars: one per day, the dashed line is the daily goal
    const scale = Math.max(goalMs * 1.3, ...days.map((d) => d.ms));
    const bars = makeEl('div', 'gw-bars');
    const line = makeEl('div', 'gw-line');
    line.style.bottom = `calc(26px + ${(goalMs / scale) * 150}px)`;
    line.append(makeEl('span', '', `daily goal ${fmtGoal(goals.focus)}`));
    bars.append(line);
    days.forEach((d, i) => {
        const reached = d.active && d.ms >= goalMs;
        const col = makeEl('div', 'gw-col' + (d.today ? ' today' : ''));
        const state = !d.active ? 'rest' : reached ? 'on' : d.today ? 'now' : d.future ? 'future' : 'low';
        const bar = makeEl('div', 'gw-bar ' + state);
        if (d.ms > 0) bar.style.height = `${Math.max(6, (d.ms / scale) * 150)}px`;
        else bar.classList.add('empty');
        const date = keyToDate(d.k);
        col.title = `${CAL_DOW[i]} ${date.getDate()} · ${d.ms ? fmtDuration(d.ms) : 'no focus'}`
            + (!d.active ? ' · rest day' : reached ? ' · goal reached' : '');
        const wrap = makeEl('div', 'gw-bar-wrap');
        wrap.append(bar);
        col.append(wrap, makeEl('span', 'gw-day', 'MTWTFSS'[i]));
        bars.append(col);
    });
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', 'Focus per day this week: ' + days.map((d, i) => `${CAL_DOW[i]} ${d.ms ? fmtDuration(d.ms) : '0'}`).join(', '));
    goalWeek.append(bars);

    // Days on goal: one dot per active day
    const active = days.filter((d) => d.active);
    const onGoal = active.filter((d) => d.ms >= goalMs).length;
    goalDays.replaceChildren();
    const dHead = makeEl('div', 'gs-head');
    dHead.append(makeEl('span', '', 'Days on goal'), makeEl('span', '', 'this week'));
    const dVal = makeEl('div', 'gs-value', String(onGoal));
    dVal.append(makeEl('span', 'goal-of', ` / ${active.length}`));
    const dots = makeEl('div', 'gs-dots');
    active.forEach((d) => {
        const hit = d.ms >= goalMs;
        const dot = makeEl('span', 'gs-dot' + (hit ? ' hit' : d.today ? ' today' : d.future ? ' future' : ''));
        if (hit) dot.innerHTML = CHECK_ICON;   // fixed markup
        dot.title = `${CAL_DOW[dowIndex(d.k)]} · ${hit ? 'goal reached' : d.future ? 'to come' : d.today ? 'today' : fmtDuration(d.ms)}`;
        dots.append(dot);
    });
    goalDays.append(dHead, dVal, dots);

    // Tasks done this week
    const weekTasks = days.reduce((a, d) => a + (d.future ? 0 : tasksDoneOn(d.k)), 0);
    const weekTaskGoal = goals.tasks * activeCount();
    goalTasksWeek.replaceChildren();
    const tHead = makeEl('div', 'gs-head');
    tHead.append(makeEl('span', '', 'Tasks done'), makeEl('span', '', 'this week'));
    const tVal = makeEl('div', 'gs-value', String(weekTasks));
    tVal.append(makeEl('span', 'goal-of', weekTaskGoal ? ` / ${weekTaskGoal}` : ''));
    const track = makeEl('div', 'gs-track');
    const fill = makeEl('div', 'gs-fill');
    fill.style.width = `${weekTaskGoal ? Math.min(100, (weekTasks / weekTaskGoal) * 100) : 0}%`;
    track.append(fill);
    goalTasksWeek.append(tHead, tVal, track);
}

// ---------- Focus tab: one quiet line under the timer ----------
const goalLine = $('goal-line');

function renderGoalLine() {
    if (!goals) { goalLine.hidden = true; goalWasReached = null; return; }
    goalLine.hidden = false;
    const todayK = dayKey();
    const ms = totalsByDay()[todayK] || 0;
    const goalMs = goals.focus * 60000;
    const rest = !isActiveDay(todayK);
    const reached = !rest && ms >= goalMs;
    goalLine.classList.toggle('reached', reached);
    goalLine.classList.toggle('rest', rest);
    if (reached && goalWasReached === false && ui.animations && goalLine.animate) {
        goalLine.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
    }
    goalWasReached = reached;

    $('goal-line-label').innerHTML = reached ? CHECK_ICON : '';   // fixed markup
    $('goal-line-label').append(reached ? ' Daily goal reached' : rest ? 'Rest day' : 'Today');
    $('goal-line-fill').style.width = `${rest ? 0 : Math.min(100, (ms / goalMs) * 100)}%`;
    $('goal-line-done').textContent = fmtDuration(ms);
    $('goal-line-goal').textContent = rest ? 'no goal today' : `goal ${fmtGoal(goals.focus)}`;
    goalLine.setAttribute('aria-label', rest ? `Rest day, ${fmtDuration(ms)} of focus`
        : `Today ${fmtDuration(ms)} of your ${fmtGoal(goals.focus)} goal${reached ? ', reached' : ''}`);
}

goalLine.addEventListener('click', () => showTab('stats'));

// Called after any change (the Stats tab redraws its own section)
function refreshGoals() {
    renderGoalLine();
    if (document.body.dataset.tab === 'stats') renderGoals();
}

// Called on every focus tick: the line under the timer, at most once a second
let goalLineTimer = null;
function refreshGoalLineSoon() {
    if (goalLineTimer) return;
    goalLineTimer = setTimeout(() => { goalLineTimer = null; renderGoalLine(); }, 1000);
}

// ---------- Editor ----------
const goalsModal = $('goals-modal');
let draft = null;
let modalReturn = null;

function renderEditor() {
    $('ge-presets').replaceChildren(...GOAL_PRESETS.map((m) => {
        const b = makeEl('button', 'pk-chip' + (draft.focus === m ? ' on' : ''), fmtGoal(m));
        b.type = 'button';
        b.dataset.preset = m;
        b.setAttribute('aria-pressed', String(draft.focus === m));
        return b;
    }));
    $('ge-focus').textContent = fmtGoal(draft.focus);
    $('ge-focus-sub').textContent = `about ${Math.max(1, Math.round(draft.focus / (settings.focus + settings.brk)))} pomodoros of ${settings.focus} min`;
    $('ge-tasks').textContent = draft.tasks ? String(draft.tasks) : 'off';
    $('ge-days').replaceChildren(...'MTWTFSS'.split('').map((l, i) => {
        const b = makeEl('button', 'ge-day' + (draft.days[i] ? ' on' : ''), l);
        b.type = 'button';
        b.dataset.day = i;
        b.setAttribute('aria-pressed', String(draft.days[i]));
        b.setAttribute('aria-label', `${CAL_DAY_FULL[(i + 1) % 7]}: ${draft.days[i] ? 'active' : 'rest day'}`);
        return b;
    }));
    const n = draft.days.filter(Boolean).length;
    $('ge-week').textContent = fmtGoal(draft.focus * n);
    $('ge-week-sub').textContent = `${fmtGoal(draft.focus)} × ${n} ${n === 1 ? 'day' : 'days'}, worked out for you`;
    $('ge-off').hidden = !goals;
}

function openGoalEditor() {
    draft = { ...(goals || GOAL_DEFAULT), days: (goals || GOAL_DEFAULT).days.slice() };
    modalReturn = document.activeElement;
    renderEditor();
    goalsModal.hidden = false;
    document.body.classList.add('modal-open');
    ($('ge-presets').querySelector('.on') || $('ge-presets').querySelector('button')).focus();
}

function closeGoalEditor() {
    goalsModal.hidden = true;
    document.body.classList.remove('modal-open');
    draft = null;
    if (modalReturn && modalReturn.isConnected) modalReturn.focus();
}

function saveGoals(next) {
    goals = next ? cleanGoals({ ...next, at: Date.now() }) : null;
    store.set('goals', goals);
    // Turning goals off is synced too: an empty record with a newer time wins on other devices
    store.set('goalsOffAt', next ? 0 : Date.now());
    pushSettings();
    refreshGoals();
    refreshCalendar();
}

goalsModal.addEventListener('click', (e) => {
    if (e.target === goalsModal) return closeGoalEditor();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.preset) draft.focus = Number(b.dataset.preset);
    else if (b.dataset.step === 'focus') draft.focus = Math.max(15, Math.min(960, draft.focus + Number(b.dataset.d)));
    else if (b.dataset.step === 'tasks') draft.tasks = Math.max(0, Math.min(50, draft.tasks + Number(b.dataset.d)));
    else if (b.dataset.day !== undefined) {
        const i = Number(b.dataset.day);
        draft.days[i] = !draft.days[i];
        if (!draft.days.some(Boolean)) draft.days[i] = true;   // at least one active day
    } else if (b.id === 'ge-cancel') return closeGoalEditor();
    else if (b.id === 'ge-save') { saveGoals(draft); return closeGoalEditor(); }
    else if (b.id === 'ge-off') { saveGoals(null); return closeGoalEditor(); }
    else return;
    // keep keyboard focus on the same control after the redraw
    const sel = b.dataset.preset ? `[data-preset="${b.dataset.preset}"]` : b.dataset.day !== undefined ? `[data-day="${b.dataset.day}"]` : null;
    renderEditor();
    if (sel) goalsModal.querySelector(sel).focus();
});

goalsModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeGoalEditor(); }
    else if (e.key === 'Tab') {
        const items = [...goalsModal.querySelectorAll('button:not([hidden])')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    e.stopPropagation();   // no app shortcuts while the editor is open
});

$('goals-edit').addEventListener('click', openGoalEditor);
$('goals-set').addEventListener('click', openGoalEditor);

// ---------- Sync ----------
function goalsPayload() {
    return goals || { off: true, at: store.get('goalsOffAt', 0) };
}

function applyRemoteGoals(remote) {
    if (!remote || typeof remote !== 'object') return;
    const localAt = goals ? goals.at : store.get('goalsOffAt', 0);
    if (!(Number(remote.at) > localAt)) return;
    if (remote.off) {
        goals = null;
        store.set('goalsOffAt', Number(remote.at));
    } else {
        goals = cleanGoals(remote);
    }
    store.set('goals', goals);
    refreshGoals();
    refreshCalendar();
}

// A new day while the page is open
setInterval(renderGoalLine, 60000);
