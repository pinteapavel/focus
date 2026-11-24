// Clockus — Calendar: moving tasks to another day
// Loaded as a classic script (shared global scope). Load order is set in app.html.
//
// - Drag: hold the grip of a task and drop it on a day of the month, or on a date group of the List view.
//   The day under the pointer lights up and shows how many tasks it will have.
// - Move to…: a click on the grip (touch screens, keyboard) opens a small sheet: Today, Tomorrow, Pick a date.
// - After every move a toast says where the task went, with Undo, for a few seconds.

// ---------- Moving, and Undo ----------
const mvToast = $('mv-toast');
const mvToastText = $('mv-toast-text');
const mvUndoBtn = $('mv-undo');
const MV_TOAST_MS = 5000;
let mvUndo = null;
let mvToastTimer = null;

function movedText(k) {
    if (!k) return 'Date removed';
    const l = dueLabel({ date: k });
    return `Moved to ${/^(Today|Tomorrow|Yesterday)$/.test(l) ? l.toLowerCase() : l}`;
}

// Gives the tasks a new day (null = no day). Saved like planTask: here, in each task's row and in the plan.
function moveTasks(list, date) {
    date = date || null;
    list = list.filter((t) => (t.date || null) !== date);
    if (!list.length) return;
    const before = list.map((t) => ({ id: t.id, date: t.date || null, time: t.time, dur: t.dur }));
    const at = Date.now();
    list.forEach((t) => { setPlanFields(t, [date, t.time, t.dur]); t.pAt = at; });
    renderTasks();
    list.forEach(cloudUpsert);
    pushSettings();
    showMoveToast(movedText(date), () => {
        const back = before.map((b) => [tasks.find((t) => t.id === b.id), b]).filter(([t]) => t);
        if (!back.length) return;
        const now = Date.now();
        back.forEach(([t, b]) => { setPlanFields(t, [b.date, b.time, b.dur]); t.pAt = now; });
        renderTasks();
        back.forEach(([t]) => cloudUpsert(t));
        pushSettings();
    });
}

function showMoveToast(text, undo) {
    clearTimeout(mvToastTimer);
    mvToastText.textContent = text;
    mvUndo = undo;
    mvToast.hidden = false;
    mvToast.classList.remove('in');
    void mvToast.offsetWidth;   // restart the fade-in when a second move replaces the first
    mvToast.classList.toggle('in', !!ui.animations);
    mvToastTimer = setTimeout(hideMoveToast, MV_TOAST_MS);
}

function hideMoveToast() {
    clearTimeout(mvToastTimer);
    mvToast.hidden = true;
    mvUndo = null;
}

mvUndoBtn.addEventListener('click', () => {
    const undo = mvUndo;
    hideMoveToast();
    if (undo) undo();
});

// ---------- Drag ----------
const mvBadge = makeEl('div', 'mv-badge');
mvBadge.setAttribute('aria-hidden', 'true');
mvBadge.hidden = true;
document.body.append(mvBadge);

let mvDrag = null;          // { t, li, pointerId, x0, y0, dx, dy, active, ghost, target }
let mvSuppressClick = false;

const findTask = (el) => {
    const li = el && el.closest('li[data-id]');
    return li ? tasks.find((x) => x.id === Number(li.dataset.id)) : null;
};

calContainerEl.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.mv-grip');
    if (!grip || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = findTask(grip);
    if (!t) return;
    mvDrag = { t, li: grip.closest('li'), pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, ghost: null, target: null };
    try { grip.setPointerCapture(e.pointerId); } catch {}
});

function startMoveDrag(d) {
    d.active = true;
    const r = d.li.getBoundingClientRect();
    d.dx = d.x0 - r.left;
    d.dy = d.y0 - r.top;
    const g = d.li.cloneNode(true);
    g.classList.add('mv-ghost');
    g.setAttribute('aria-hidden', 'true');
    g.style.width = `${Math.min(r.width, 280)}px`;
    if (d.dx > 260) d.dx = 24;   // a grip at the right of a long row: keep the ghost under the pointer
    document.body.append(g);
    d.ghost = g;
    d.li.classList.add('mv-src');
    document.body.classList.add('mv-dragging');
}

// The day under the pointer: a cell of the month, or a date group of the list (not the task's own day)
function dropTargetAt(x, y, t) {
    const el = document.elementFromPoint(x, y);
    const box = el && el.closest('.cal-cell[data-day], .up-group[data-day]');
    if (!box || !calContainerEl.contains(box) || box.dataset.day === t.date) return null;
    return box;
}

function setDropTarget(d, box) {
    if (d.target === box) return;
    if (d.target) d.target.classList.remove('drop');
    d.target = box;
    mvBadge.hidden = true;
    if (!box) return;
    box.classList.add('drop');
    if (box.classList.contains('cal-cell')) {
        // "Wed 18 · 2 tasks → 3", just under the day
        const k = box.dataset.day;
        const n = tasks.filter((x) => x.date === k).length;
        const day = keyToDate(k);
        mvBadge.textContent = `${CAL_DOW[(day.getDay() + 6) % 7]} ${day.getDate()} · ${countText(n)} → ${n + 1}`;
        mvBadge.hidden = false;
        const r = box.getBoundingClientRect();
        const w = mvBadge.offsetWidth;
        mvBadge.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
        mvBadge.style.top = `${r.bottom + 6}px`;
    }
}

document.addEventListener('pointermove', (e) => {
    const d = mvDrag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
        startMoveDrag(d);
    }
    e.preventDefault();
    d.ghost.style.transform = `translate(${e.clientX - d.dx}px, ${e.clientY - d.dy}px)`;
    setDropTarget(d, dropTargetAt(e.clientX, e.clientY, d.t));
    // Near the top or bottom edge: the page scrolls, so far groups of the list can be reached
    const edge = 60;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
});

function endMoveDrag(cancel) {
    const d = mvDrag;
    mvDrag = null;
    if (!d || !d.active) return;   // no movement: it was a click, which opens "Move to…"
    mvSuppressClick = true;
    setTimeout(() => { mvSuppressClick = false; }, 0);
    const target = d.target;
    setDropTarget(d, null);
    d.ghost.remove();
    d.li.classList.remove('mv-src');
    document.body.classList.remove('mv-dragging');
    if (!cancel && target) moveTasks([d.t], target.dataset.day);
}

document.addEventListener('pointerup', (e) => { if (mvDrag && e.pointerId === mvDrag.pointerId) endMoveDrag(false); });
document.addEventListener('pointercancel', (e) => { if (mvDrag && e.pointerId === mvDrag.pointerId) endMoveDrag(true); });
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mvDrag && mvDrag.active) { e.stopPropagation(); endMoveDrag(true); }
}, true);

// ---------- "Move to…": Today, Tomorrow, Pick a date ----------
const mvBackdrop = makeEl('div', 'mv-backdrop');
const mvSheet = makeEl('div', 'mv-sheet');
mvSheet.setAttribute('role', 'dialog');
mvSheet.setAttribute('aria-modal', 'true');
mvSheet.setAttribute('aria-label', 'Move to');
mvSheet.hidden = true;
mvBackdrop.hidden = true;
document.body.append(mvBackdrop, mvSheet);
let mvState = null;   // { t, anchor }

const PICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';

function mvOption(name, side, act, day, on) {
    const b = makeEl('button', 'mv-opt' + (on ? ' on' : ''));
    b.type = 'button';
    b.dataset.act = act;
    if (day) b.dataset.day = day;
    const right = makeEl('span', 'mv-opt-side');
    if (side) right.textContent = side; else right.innerHTML = PICK_ICON;   // fixed markup, no user text
    b.append(makeEl('span', 'mv-opt-name', name), right);
    return b;
}

function openMoveSheet(t, anchor) {
    const todayK = dayKey();
    const tomorrowK = addDays(todayK, 1);
    const short = (k) => { const d = keyToDate(k); return `${CAL_DOW[(d.getDay() + 6) % 7]} ${d.getDate()}`; };
    mvState = { t, anchor };
    mvSheet.replaceChildren(
        makeEl('div', 'mv-handle'),
        makeEl('div', 'mv-task', t.text),
        makeEl('div', 'mv-sub', 'Move to…'),
        mvOption('Today', short(todayK), 'day', todayK, t.date === todayK),
        mvOption('Tomorrow', short(tomorrowK), 'day', tomorrowK, t.date === tomorrowK),
        mvOption('Pick a date', '', 'pick')
    );
    mvSheet.hidden = false;
    mvBackdrop.hidden = false;
    placeMoveSheet();
    const first = mvSheet.querySelector('.mv-opt');
    if (first) first.focus();
}

// Phone: a sheet from the bottom. Larger screens: a small window next to the grip.
function placeMoveSheet() {
    const sheet = window.innerWidth <= 600;
    mvSheet.classList.toggle('sheet', sheet);
    mvBackdrop.classList.toggle('dim', sheet);
    if (sheet || !mvState) { mvSheet.style.left = ''; mvSheet.style.top = ''; return; }
    const a = mvState.anchor.getBoundingClientRect();
    const w = mvSheet.offsetWidth;
    const h = mvSheet.offsetHeight;
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, a.right - w));
    let top = a.bottom + 8;
    if (top + h > window.innerHeight - 12) top = Math.max(12, a.top - h - 8);
    mvSheet.style.left = `${left}px`;
    mvSheet.style.top = `${top}px`;
}

function closeMoveSheet(refocus) {
    if (mvSheet.hidden) return;
    mvSheet.hidden = true;
    mvBackdrop.hidden = true;
    const anchor = mvState && mvState.anchor;
    mvState = null;
    if (refocus && anchor && anchor.isConnected) anchor.focus();
}

calContainerEl.addEventListener('click', (e) => {
    const grip = e.target.closest('.mv-grip');
    if (!grip) return;
    e.preventDefault();
    if (mvSuppressClick) return;
    const t = findTask(grip);
    if (t) openMoveSheet(t, grip);
});

mvSheet.addEventListener('click', (e) => {
    const b = e.target.closest('.mv-opt');
    if (!b || !mvState) return;
    const { t, anchor } = mvState;
    if (b.dataset.act === 'pick') {
        closeMoveSheet(false);
        openDatePicker(anchor, t.date, (date) => moveTasks([t], date));
        return;
    }
    closeMoveSheet(false);
    moveTasks([t], b.dataset.day);
});

mvSheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMoveSheet(true); return; }
    if (e.key === 'Tab') {
        const items = [...mvSheet.querySelectorAll('button')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    e.stopPropagation();   // the app's single-key shortcuts must not fire here
});

mvBackdrop.addEventListener('pointerdown', (e) => { e.preventDefault(); closeMoveSheet(true); });
window.addEventListener('resize', () => { if (!mvSheet.hidden) placeMoveSheet(); });
