// Clockus — the date picker: gives a task a day (or takes it away), in one small window
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// Used by the To do list: openDatePicker(anchor, date, onPick)
// onPick('YYYY-MM-DD' | null) is called as soon as a day (or "No date") is chosen. A task has at most a day, no time.

const pkBackdrop = makeEl('div', 'pk-backdrop');
const pk = makeEl('div', 'pk');
pk.setAttribute('role', 'dialog');
pk.setAttribute('aria-modal', 'true');
pk.setAttribute('aria-label', 'Choose a date');
pk.hidden = true;
pkBackdrop.hidden = true;
document.body.append(pkBackdrop, pk);

let pkState = null;   // { date, month, onPick, anchor }

const pickerOpen = () => !pk.hidden;

function pkButton(cls, text, action, value) {
    const b = makeEl('button', cls, text);
    b.type = 'button';
    b.dataset.act = action;
    if (value !== undefined) b.dataset.val = value;
    return b;
}

function pkDayLabel(k) {
    const d = keyToDate(k);
    const diff = Math.round((d - keyToDate(dayKey())) / 86400000);
    const base = `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    return diff === 0 ? `Today, ${base}` : diff === 1 ? `Tomorrow, ${base}` : base;
}

function renderPicker() {
    const s = pkState;
    const todayK = dayKey();
    pk.replaceChildren();

    // Quick choices
    const quick = makeEl('div', 'pk-chips');
    [['Today', todayK], ['Tomorrow', addDays(todayK, 1)], ['Next week', addDays(mondayOf(todayK), 7)], ['No date', '']].forEach(([name, k]) => {
        const on = (s.date || '') === k;
        const b = pkButton('pk-chip' + (on ? ' on' : ''), name, 'day', k);
        b.setAttribute('aria-pressed', String(on));
        quick.append(b);
    });
    pk.append(quick);

    // Month
    const m = keyToDate(s.month);
    const head = makeEl('div', 'pk-month-head');
    const prev = pkButton('pk-arrow', '‹', 'month', '-1');
    prev.setAttribute('aria-label', 'Previous month');
    const next = pkButton('pk-arrow', '›', 'month', '1');
    next.setAttribute('aria-label', 'Next month');
    head.append(prev, makeEl('span', '', `${CAL_MONTHS[m.getMonth()]} ${m.getFullYear()}`), next);
    pk.append(head);

    const grid = makeEl('div', 'pk-days');
    'MTWTFSS'.split('').forEach((l) => grid.append(makeEl('span', 'pk-dow', l)));
    const start = mondayOf(s.month);
    const busyDays = new Set(tasks.filter((t) => t.date && !t.done).map((t) => t.date));
    for (let i = 0; i < 42; i++) {
        const k = addDays(start, i);
        const d = keyToDate(k);
        if (i >= 28 && i % 7 === 0 && d.getMonth() !== m.getMonth()) break;
        const b = pkButton('pk-day' + (d.getMonth() !== m.getMonth() ? ' out' : '') + (k === todayK ? ' today' : '')
            + (k === s.date ? ' on' : '') + (k < todayK ? ' past' : '') + (busyDays.has(k) ? ' busy' : ''), String(d.getDate()), 'day', k);
        b.setAttribute('aria-label', pkDayLabel(k) + (busyDays.has(k) ? ', has tasks' : ''));
        b.setAttribute('aria-pressed', String(k === s.date));
        grid.append(b);
    }
    pk.append(grid);
}

function placePicker() {
    const sheet = window.innerWidth <= 600;
    pk.classList.toggle('sheet', sheet);
    pkBackdrop.classList.toggle('dim', sheet);
    if (sheet) { pk.style.left = ''; pk.style.top = ''; return; }
    const a = pkState.anchor.getBoundingClientRect();
    const w = pk.offsetWidth;
    const h = pk.offsetHeight;
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, a.right - w));
    let top = a.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, a.top - h - 8);
    pk.style.left = `${left}px`;
    pk.style.top = `${top}px`;
}

function openDatePicker(anchor, date, onPick) {
    pkState = { date: isDayKey(date) ? date : null, month: monthOf(isDayKey(date) ? date : dayKey()), onPick, anchor };
    renderPicker();
    pk.hidden = false;
    pkBackdrop.hidden = false;
    placePicker();
    const first = pk.querySelector('.pk-day.on') || pk.querySelector('.pk-chip');
    if (first) first.focus();
}

function closePicker() {
    if (!pickerOpen()) return;
    pk.hidden = true;
    pkBackdrop.hidden = true;
    const anchor = pkState && pkState.anchor;
    pkState = null;
    if (anchor && anchor.isConnected) anchor.focus();
}

pk.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || !pkState) return;
    const s = pkState;
    if (b.dataset.act === 'month') {
        s.month = addMonths(s.month, Number(b.dataset.val));
        renderPicker();
        placePicker();
        const again = pk.querySelector(`.pk-arrow[data-val="${b.dataset.val}"]`);
        if (again) again.focus();
        return;
    }
    // A day or a quick choice: saved right away
    const cb = s.onPick;
    const date = b.dataset.val || null;
    closePicker();
    cb(date);
});

pk.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); return; }
    // Keep Tab inside the window
    if (e.key === 'Tab') {
        const items = [...pk.querySelectorAll('button:not(:disabled)')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    e.stopPropagation();   // the app's single-key shortcuts must not fire while picking
});

pkBackdrop.addEventListener('pointerdown', (e) => { e.preventDefault(); closePicker(); });
window.addEventListener('resize', () => { if (pickerOpen()) placePicker(); });
