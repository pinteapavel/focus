// Clockus — Calendar, List view ("Upcoming"): the tasks grouped by date
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// Groups: Overdue, Today, Tomorrow, then each later day that has tasks (empty days are not shown).
// Same tasks as the Month view and To do: moving, ticking or adding here changes them everywhere.
// Tasks are dragged between groups by their grip (calendar-move.js).

const upGroups = $('up-groups');
const upForm = $('up-add');
const upInput = $('up-input');
const upDoneBtn = $('up-done');
// "Show done": done tasks stay in their groups, crossed out (this device only, key `calShowDone`)
let upShowDone = store.get('calShowDone', false) === true;
const upPhone = window.matchMedia('(max-width: 600px)');

const countText = (n) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

// "Sun 15 Nov" (with the year when it is not this year)
function upDate(k) {
    const d = keyToDate(k);
    return `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
        + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
}

function upGroup(o) {
    const sec = makeEl('section', 'up-group' + (o.key === 'overdue' ? ' late' : ''));
    if (o.day) sec.dataset.day = o.day;
    const head = makeEl('div', 'up-group-head');
    head.append(makeEl('span', 'up-group-name', o.name));
    if (o.date) head.append(makeEl('span', 'up-group-date', o.date));
    if (o.count) head.append(makeEl('span', 'up-group-count', countText(o.list.length)));
    if (o.day) head.append(makeEl('span', 'up-drop', 'drop here'));
    if (o.key === 'overdue') {
        const all = makeEl('button', 'cal-link up-all', 'Move all to today');
        all.type = 'button';
        all.dataset.act = 'all-today';
        head.append(all);
    }
    sec.append(head);
    if (o.list.length) {
        const ul = makeEl('ul', 'day-tasks');
        ul.append(...o.list.map((t) => dayRow(t, { grip: true, gripFirst: true })));
        sec.append(ul);
    } else {
        sec.append(makeEl('p', 'up-empty', 'Nothing planned.'));
    }
    return sec;
}

function renderList() {
    const todayK = dayKey();
    const tomorrowK = addDays(todayK, 1);
    const show = (t) => upShowDone || !t.done;
    upDoneBtn.classList.toggle('on', upShowDone);
    upDoneBtn.setAttribute('aria-pressed', String(upShowDone));
    upInput.placeholder = upPhone.matches ? 'Add a task…' : 'Add a task… try “Email Ana friday”';

    const groups = [];
    const late = tasks.filter(isOverdue).sort((a, b) => a.date.localeCompare(b.date));
    if (late.length) groups.push({ key: 'overdue', name: 'Overdue', list: late, count: true });
    groups.push({ key: todayK, day: todayK, name: 'Today', date: upDate(todayK), list: tasksOn(todayK).filter(show) });
    groups.push({ key: tomorrowK, day: tomorrowK, name: 'Tomorrow', date: upDate(tomorrowK), list: tasksOn(tomorrowK).filter(show) });
    [...new Set(tasks.filter((t) => t.date && t.date > tomorrowK && show(t)).map((t) => t.date))].sort()
        .forEach((k) => groups.push({ key: k, day: k, name: upDate(k), list: tasksOn(k).filter(show), count: true }));

    upGroups.replaceChildren(...groups.map(upGroup));
}

// ---------- The add box: a day in the words becomes the date ("Email Ana friday") ----------
const UP_WEEKDAYS = [
    ['sunday', 'sun'], ['monday', 'mon'], ['tuesday', 'tues', 'tue'], ['wednesday', 'wed'],
    ['thursday', 'thurs', 'thur', 'thu'], ['friday', 'fri'], ['saturday', 'sat']
];

// Returns { text, date }: the words that name the day are taken out of the text. No day named: today.
function parseTaskWords(raw) {
    const todayK = dayKey();
    const tidy = (s) => s.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    const take = (re, date) => {
        const m = raw.match(re);
        if (!m) return null;
        const text = tidy(raw.slice(0, m.index) + ' ' + raw.slice(m.index + m[0].length));
        return { text: text || raw.trim(), date };
    };
    const found = take(/\b(?:today|tonight)\b/i, todayK)
        || take(/\b(?:tomorrow|tmrw|tmr)\b/i, addDays(todayK, 1))
        || take(/\bnext week\b/i, addDays(mondayOf(todayK), 7));
    if (found) return found;

    const dow = keyToDate(todayK).getDay();
    for (let i = 0; i < 7; i++) {
        const [full, ...short] = UP_WEEKDAYS[i];
        // Full names anywhere; short ones ("fri") only as the last word, so "sun cream" stays a task
        const res = [new RegExp(`\\b(?:on\\s+)?(next\\s+)?${full}\\b`, 'i'),
            new RegExp(`\\s(?:on\\s+)?(next\\s+)?(?:${short.join('|')})\\.?\\s*$`, 'i')];
        for (const re of res) {
            const m = raw.match(re);
            if (!m) continue;
            let n = (i - dow + 7) % 7;
            if (m[1] && n === 0) n = 7;
            return take(re, addDays(todayK, n));
        }
    }
    return { text: raw.trim(), date: todayK };
}

upForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = upInput.value.trim();
    if (!raw) return;
    const { text, date } = parseTaskWords(raw);
    if (addTaskOn(text, date)) upInput.value = '';
});

upDoneBtn.addEventListener('click', () => {
    upShowDone = !upShowDone;
    store.set('calShowDone', upShowDone);
    renderList();
});

// Ticking a task here ticks it everywhere
upGroups.addEventListener('change', (e) => {
    const li = e.target.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (t && e.target.type === 'checkbox') setTaskDone(t, e.target.checked);
});

upGroups.addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="all-today"]')) return;
    moveTasks(tasks.filter(isOverdue), dayKey());   // calendar-move.js, with Undo
});

upPhone.addEventListener('change', () => { if (calendarOpen() && calView === 'list') renderList(); });
