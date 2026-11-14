// Clockus — the "when" picker: day, time and length of a task, in one small window
// Loaded as a classic script (shared global scope). Load order is set in app.html.
// Used by the To do list and the Calendar: openPlanPicker(anchor, { date, time, dur, excludeId }, onSave)
// onSave(date | null, time | null, minutes) is called only when the user presses Save.

const PICKER_LENGTHS = [15, 25, 30, 45, 60, 90, 120];
const pkBackdrop = makeEl('div', 'pk-backdrop');
const pk = makeEl('div', 'pk');
pk.setAttribute('role', 'dialog');
pk.setAttribute('aria-modal', 'true');
pk.setAttribute('aria-label', 'Choose a day and a time');
pk.hidden = true;
pkBackdrop.hidden = true;
document.body.append(pkBackdrop, pk);

let pkState = null;   // { date, time, dur, month, excludeId, onSave, anchor }

const pickerOpen = () => !pk.hidden;

function pkButton(cls, text, action, value) {
    const b = makeEl('button', cls, text);
    b.type = 'button';
    b.dataset.act = action;
    if (value !== undefined) b.dataset.val = value;
    return b;
}

// "9" "930" "9:30" "21.15" "0915" -> "09:30" etc.
function parseTime(s) {
    const m = String(s).trim().match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = m[2] === undefined ? 0 : Number(m[2]);
    return h < 24 && min < 60 ? `${pad2(h)}:${pad2(min)}` : null;
}

// First free slot of the given length on that day (after now if it is today)
function nextFreeSlot(date, dur, excludeId) {
    const busy = tasks
        .filter((t) => t.date === date && t.time && !t.done && t.id !== excludeId)
        .map((t) => [toMin(t.time), toMin(t.time) + (t.dur || DEFAULT_DUR)]);
    let start = 8 * 60;
    if (date === dayKey()) {
        const n = new Date();
        start = Math.max(start, Math.ceil((n.getHours() * 60 + n.getMinutes() + 5) / 15) * 15);
    } else if (date < dayKey()) return null;
    for (let s = start; s + dur <= 24 * 60; s += 15) {
        if (!busy.some(([a, b]) => s < b && s + dur > a)) return fromMin(s);
    }
    return null;
}

function pkDayLabel(k) {
    if (!k) return 'No day';
    const d = keyToDate(k);
    const diff = Math.round((d - keyToDate(dayKey())) / 86400000);
    const base = `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    return diff === 0 ? `Today, ${base}` : diff === 1 ? `Tomorrow, ${base}` : base;
}

function renderPicker() {
    const s = pkState;
    const todayK = dayKey();
    pk.replaceChildren();

    // Quick days
    const nextMon = addDays(mondayOf(todayK), 7);
    const quick = makeEl('div', 'pk-chips');
    [['Today', todayK], ['Tomorrow', addDays(todayK, 1)], ['Next week', nextMon], ['No day', '']].forEach(([name, k]) => {
        const b = pkButton('pk-chip' + ((s.date || '') === k ? ' on' : ''), name, 'day', k);
        b.setAttribute('aria-pressed', String((s.date || '') === k));
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

    // Time
    pk.append(makeEl('div', 'pk-sec', 'Time'));
    const timeRow = makeEl('div', 'pk-time' + (s.date ? '' : ' off'));
    const minus = pkButton('pk-step', '−', 'step', '-15');
    minus.setAttribute('aria-label', '15 minutes earlier');
    const plus = pkButton('pk-step', '+', 'step', '15');
    plus.setAttribute('aria-label', '15 minutes later');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pk-time-input';
    input.inputMode = 'numeric';
    input.maxLength = 5;
    input.placeholder = '--:--';
    input.value = s.time || '';
    input.setAttribute('aria-label', 'Time, for example 9:30');
    [minus, input, plus].forEach((el) => { el.disabled = !s.date; });
    timeRow.append(minus, input, plus);
    pk.append(timeRow);

    const timeChips = makeEl('div', 'pk-chips');
    const noTime = pkButton('pk-chip' + (!s.time ? ' on' : ''), 'No time', 'time', '');
    timeChips.append(noTime);
    const free = s.date ? nextFreeSlot(s.date, s.dur, s.excludeId) : null;
    if (free) {
        const b = pkButton('pk-chip pk-free' + (s.time === free ? ' on' : ''), `Next free ${free}`, 'time', free);
        b.title = `First free ${s.dur} minutes on this day`;
        timeChips.append(b);
    }
    ['09:00', '13:00', '18:00'].forEach((t) => {
        if (t !== free) timeChips.append(pkButton('pk-chip' + (s.time === t ? ' on' : ''), t, 'time', t));
    });
    [...timeChips.children].forEach((b) => { b.disabled = !s.date; });
    pk.append(timeChips);

    // Length
    pk.append(makeEl('div', 'pk-sec', 'Length'));
    const lens = makeEl('div', 'pk-chips');
    const lengths = [...new Set([...PICKER_LENGTHS, settings.focus])].sort((a, b) => a - b);
    lengths.forEach((n) => {
        const label = n < 60 ? `${n}m` : n % 60 ? `${Math.floor(n / 60)}h${pad2(n % 60)}` : `${n / 60}h`;
        const b = pkButton('pk-chip' + (s.dur === n ? ' on' : ''), label, 'dur', String(n));
        if (n === settings.focus) b.title = 'One focus session';
        b.disabled = !s.time;
        lens.append(b);
    });
    pk.append(lens);

    // Summary + actions
    const sum = makeEl('div', 'pk-summary');
    sum.textContent = !s.date ? 'Not scheduled' : s.time
        ? `${pkDayLabel(s.date)} · ${s.time} – ${fromMin(toMin(s.time) + s.dur)}`
        : `${pkDayLabel(s.date)} · any time`;
    pk.append(sum);
    const actions = makeEl('div', 'pk-actions');
    actions.append(pkButton('btn', 'Cancel', 'cancel'), pkButton('btn primary', 'Save', 'save'));
    pk.append(actions);
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

function openPlanPicker(anchor, { date = null, time = null, dur = 0, excludeId = null } = {}, onSave) {
    pkState = {
        date: date || null,
        time: date && time ? time : null,
        dur: dur || DEFAULT_DUR,
        month: monthOf(date || dayKey()),
        excludeId, onSave, anchor
    };
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

function savePicker() {
    const s = pkState;
    if (!s) return;   // already closed (e.g. Enter, then the field's own change event)
    const input = pk.querySelector('.pk-time-input');
    if (input && input.value.trim()) s.time = parseTime(input.value) || s.time;
    else if (input) s.time = null;
    const cb = s.onSave;
    const result = [s.date, s.date ? s.time : null, s.time ? s.dur : 0];
    closePicker();
    cb(...result);
}

// Keeps the focused control after a redraw (so keyboard users don't lose their place)
function rerenderPicker(focusSel) {
    renderPicker();
    placePicker();
    const el = focusSel && pk.querySelector(focusSel);
    if (el) el.focus();
}

pk.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || !pkState) return;
    const s = pkState;
    const v = b.dataset.val;
    switch (b.dataset.act) {
        case 'day':
            s.date = v || null;
            if (!s.date) s.time = null;
            else s.month = monthOf(s.date);
            return rerenderPicker(v ? `.pk-day[data-val="${v}"]` : '.pk-chip[data-val=""]');
        case 'month':
            s.month = addMonths(s.month, Number(v));
            return rerenderPicker(`.pk-arrow[data-val="${v}"]`);
        case 'step': {
            const typed = parseTime(pk.querySelector('.pk-time-input').value);
            const base = typed || s.time || nextFreeSlot(s.date, s.dur, s.excludeId) || '09:00';
            const m = toMin(base) + Number(v);
            s.time = fromMin(Math.max(0, Math.min(23 * 60 + 45, Math.round(m / 15) * 15)));
            return rerenderPicker(`.pk-step[data-val="${v}"]`);
        }
        case 'time':
            s.time = v || null;
            return rerenderPicker(`.pk-chip[data-act="time"][data-val="${v}"]`);
        case 'dur':
            s.dur = Number(v);
            return rerenderPicker(`.pk-chip[data-act="dur"][data-val="${v}"]`);
        case 'cancel': return closePicker();
        case 'save': return savePicker();
    }
});

pk.addEventListener('change', (e) => {
    if (!pkState || !e.target.classList.contains('pk-time-input')) return;
    const t = parseTime(e.target.value);
    pkState.time = e.target.value.trim() ? (t || pkState.time) : null;
    rerenderPicker('.pk-time-input');
});

pk.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); return; }
    if (e.key === 'Enter' && e.target.classList.contains('pk-time-input')) { e.preventDefault(); savePicker(); return; }
    // Keep Tab inside the window
    if (e.key === 'Tab') {
        const items = [...pk.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    e.stopPropagation();   // the app's single-key shortcuts must not fire while picking
});

pkBackdrop.addEventListener('pointerdown', (e) => { e.preventDefault(); closePicker(); });
window.addEventListener('resize', () => { if (pickerOpen()) placePicker(); });
