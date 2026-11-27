// Clockus — task notes and search (To do tab), and the note of the current task during focus
// Loaded as a classic script (shared global scope). Load order is set in app.html (after aesthetic-mode.js).
//
// - A note is plain text, up to 2000 characters, saved in the task itself (t.note) and synced with it
//   (column `note` of `tasks`, docs/sql/tasks-note.sql). It autosaves a second after you stop typing.
// - To do: one search field for titles and notes (as you type, matches highlighted), filters All / Open / Done /
//   With notes, a note line (icon + first line) under tasks that have one, and a side panel with the full note
//   (phone: full screen). Enter in the search opens the first result; / focuses the search.
// - Focus tab: a note badge next to the task name opens the note under the timer. In Aesthetic mode the badge
//   sits on the task chip and the note opens as a small glass panel above the widget. Open or closed is remembered.

const NOTE_MAX = 2000;
const NOTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>';

const noteText = (t) => (t && typeof t.note === 'string' ? t.note : '');
const noteLines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const taskById = (id) => tasks.find((t) => t.id === id);

// ---------- Saving a note (shared by every editor) ----------
const noteTimers = {};

function saveNote(t, value) {
    value = String(value).slice(0, NOTE_MAX);
    if (!value.trim()) value = '';
    if (value === noteText(t)) return;
    if (value) t.note = value; else delete t.note;
    renderTasks();       // saves, redraws the list (the open editors keep their text)
    cloudUpsert(t);
}

// Autosave after a second without typing; `onState` shows "Saving…" / "Saved"
function bindNoteEditor(area, getTask, onState) {
    const flush = () => {
        const t = getTask();
        clearTimeout(noteTimers[area.id]);
        noteTimers[area.id] = null;
        if (t) saveNote(t, area.value);
        if (onState) onState('Saved');
    };
    area.addEventListener('input', () => {
        if (onState) onState('Saving…');
        clearTimeout(noteTimers[area.id]);
        noteTimers[area.id] = setTimeout(flush, 1000);
    });
    area.addEventListener('blur', () => { if (noteTimers[area.id]) flush(); });
    area.flushNote = () => { if (noteTimers[area.id]) flush(); };
}

// Puts the task's note in an editor, unless you are typing in it
function syncEditor(area, t) {
    if (document.activeElement === area || noteTimers[area.id]) return;
    const v = noteText(t);
    if (area.value !== v) area.value = v;
}

// ---------- Search and filters ----------
const tnQuery = $('tn-query');
const tnClear = $('tn-clear');
const tnCount = $('tn-count');
const tnHint = $('tn-hint');
const tnFilterBtns = document.querySelectorAll('[data-tn-filter]');
let tnQ = '';            // what you typed, normalised
let tnFilter = 'all';

// Lower case, without accents, so "sa" finds "să" and "Ș" finds "s"
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function matchAt(text) {
    if (!tnQ) return -1;
    return fold(text).indexOf(tnQ);
}

const filtering = () => !!tnQ || tnFilter !== 'all';

function filterTodo(list) {
    todoList.classList.toggle('filtered', filtering());
    return list.filter((t) => {
        if (tnFilter === 'open' && t.done) return false;
        if (tnFilter === 'done' && !t.done) return false;
        if (tnFilter === 'notes' && !noteText(t).trim()) return false;
        return !tnQ || matchAt(t.text) >= 0 || matchAt(noteText(t)) >= 0;
    });
}

function todoEmptyText() {
    if (tnQ) return `No tasks match “${tnQuery.value.trim()}”.`;
    return { open: 'No open tasks.', done: 'Nothing done today yet.', notes: 'No tasks with notes yet.' }[tnFilter] || 'Nothing here yet. Add your first task and start a focus session.';
}

// The text with what matched in <mark> (folding keeps one character per letter, so positions line up)
function fillMatch(el, text) {
    const i = matchAt(text);
    if (i < 0 || fold(text).length !== text.length) {
        el.textContent = text;
        if (i >= 0) el.classList.add('tn-hit');   // rare letters that fold to two: no exact spot, mark the whole line
        return;
    }
    el.replaceChildren(text.slice(0, i), makeEl('mark', 'tn-mark', text.slice(i, i + tnQ.length)), text.slice(i + tnQ.length));
}

// Under a task with a note: the icon and the first line (when searching, the line that matched)
function noteLineEl(t) {
    const lines = noteLines(noteText(t));
    if (!lines.length) return null;
    const line = (tnQ && lines.find((l) => matchAt(l) >= 0)) || lines[0];
    const b = makeEl('button', 'todo-note');
    b.type = 'button';
    b.innerHTML = NOTE_ICON;   // fixed markup, no user text
    const txt = makeEl('em', 'todo-note-text');
    fillMatch(txt, line);
    b.append(txt);
    b.setAttribute('aria-label', `Note: ${line}. Open`);
    return b;
}

function afterTodoFilter(n) {
    press(tnFilterBtns, (b) => b.dataset.tnFilter === tnFilter);
    tnClear.hidden = !tnQuery.value;
    tnCount.hidden = !tnQ;
    tnCount.textContent = `${n} ${n === 1 ? 'result' : 'results'}`;
    tnHint.hidden = !tnQ || !n;
    // The open task may have been deleted, or changed on another device
    if (tnOpenId !== null && !taskById(tnOpenId)) closeTask();
    else if (tnOpenId !== null) renderPanel();
    renderFocusNote();
}

tnQuery.addEventListener('input', () => {
    tnQ = fold(tnQuery.value.trim());
    renderTasks();
});

tnQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const first = todoList.querySelector('.todo-item');
        if (first) openTask(Number(first.dataset.id));
    } else if (e.key === 'Escape' && tnQuery.value) {
        e.stopPropagation();
        clearSearch();
    } else if (e.key === 'Escape') {
        e.stopPropagation();
        tnQuery.blur();
    }
});

function clearSearch() {
    tnQuery.value = '';
    tnQ = '';
    renderTasks();
    tnQuery.focus();
}

tnClear.addEventListener('click', clearSearch);
tnFilterBtns.forEach((b) => b.addEventListener('click', () => {
    tnFilter = b.dataset.tnFilter;
    renderTasks();
}));

// "/" focuses the search on the To do tab
document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || aesOpen) return;
    if (document.body.dataset.tab !== 'todo') return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    e.preventDefault();
    tnQuery.focus();
    tnQuery.select();
});

// ---------- Side panel: the task and its full note ----------
const tnPanel = $('tn-panel');
const tnPanelNote = $('tn-panel-note');
const tnPanelState = $('tn-panel-state');
const tnPanelCount = $('tn-panel-count');
let tnOpenId = null;
let tnReturn = null;

const isTaskOpen = (id) => id === tnOpenId;

// Focus time spent on the task (from the focus sessions)
function focusedOn(t) {
    return sessions.reduce((a, s) => a + (s.t === t.id ? Math.max(0, s.e - s.s) : 0), 0);
}

function renderPanel() {
    const t = taskById(tnOpenId);
    if (!t) return;
    $('tn-panel-title').textContent = t.text;
    const chips = [];
    if (t.done) chips.push('Done');
    else if (t.date) chips.push(dueLabel(t));
    if (!t.done && t.id === topPriorityId) chips.push('Top priority');
    const ms = focusedOn(t);
    if (ms >= 60000) chips.push(`${fmtDuration(ms)} focused`);
    $('tn-panel-chips').replaceChildren(...chips.map((c) => makeEl('span', 'tn-chip', c)));
    syncEditor(tnPanelNote, t);
    tnPanelCount.textContent = `${tnPanelNote.value.length} / ${NOTE_MAX}`;
}

function openTask(id) {
    if (tnOpenId !== null && tnOpenId !== id) tnPanelNote.flushNote();
    if (!taskById(id)) return;
    if (tnOpenId === null) tnReturn = document.activeElement;
    tnOpenId = id;
    tnPanelNote.value = noteText(taskById(id));
    tnPanelState.textContent = 'Saved';
    tnPanel.hidden = false;
    document.body.classList.add('tn-open');
    renderTasks();   // marks the open row (and renders the panel)
    tnPanelNote.focus();
    tnPanelNote.setSelectionRange(tnPanelNote.value.length, tnPanelNote.value.length);
}

function closeTask() {
    if (tnOpenId === null) return;
    tnPanelNote.flushNote();
    tnOpenId = null;
    tnPanel.hidden = true;
    document.body.classList.remove('tn-open');
    renderTasks();
    if (tnReturn && tnReturn.isConnected) tnReturn.focus();
    tnReturn = null;
}

bindNoteEditor(tnPanelNote, () => taskById(tnOpenId), (s) => { tnPanelState.textContent = s; });
tnPanelNote.addEventListener('input', () => { tnPanelCount.textContent = `${tnPanelNote.value.length} / ${NOTE_MAX}`; });
tnPanelNote.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTask(); }
});
$('tn-panel-close').addEventListener('click', closeTask);
// Esc anywhere on the To do tab closes the panel (inputs handle their own Esc first)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || tnOpenId === null || document.body.dataset.tab !== 'todo') return;
    if (e.target.closest && e.target.closest('input, textarea, .pk, .mv-sheet')) return;
    closeTask();
});
tnPanel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeTask(); }
});

// The note line or the Note button of a task opens it
todoList.addEventListener('click', (e) => {
    const b = e.target.closest('.todo-note, .note-btn');
    if (!b) return;
    const id = Number(b.closest('li').dataset.id);
    if (tnOpenId === id && b.classList.contains('note-btn')) closeTask();
    else openTask(id);
});

// ---------- Focus tab and Aesthetic mode: the note of the current task ----------
let noteOpen = store.get('noteOpen', false) === true;
const noteBadge = $('note-badge');
const focusNote = $('focus-note');
const focusNoteInput = $('focus-note-input');

// Aesthetic mode: the badge next to the task on the widget, the glass panel above it
const aesLabelEl = $('aes-label-text');
const aesLabelRow = makeEl('span', 'aes-label-row');
aesLabelEl.replaceWith(aesLabelRow);
const aesNoteBadge = makeEl('button', 'note-badge aes-note-badge');
aesNoteBadge.type = 'button';
aesLabelRow.append(aesLabelEl, aesNoteBadge);
const aesNote = makeEl('div', 'aes-note');
const aesNoteInput = makeEl('textarea', '');
aesNoteInput.id = 'aes-note-input';
aesNoteInput.maxLength = NOTE_MAX;
aesNoteInput.rows = 4;
aesNoteInput.placeholder = 'Write a note for this task…';
aesNoteInput.setAttribute('aria-label', 'Note of the current task');
aesNote.append(aesNoteInput);
aesNote.hidden = true;
$('aes').append(aesNote);

const currentTask = () => tasks.find((x) => x.id === currentTaskId && !x.done) || null;

function fillBadge(b, t) {
    const n = noteLines(noteText(t)).length;
    b.innerHTML = NOTE_ICON;   // fixed markup, no user text
    if (n) b.append(makeEl('span', 'note-badge-num', String(n)));
    b.classList.toggle('on', noteOpen);
    b.setAttribute('aria-expanded', String(noteOpen));
    const what = n ? `Note, ${n} ${n === 1 ? 'line' : 'lines'}` : 'Add a note';
    b.setAttribute('aria-label', `${what}. ${noteOpen ? 'Close' : 'Open'}`);
    b.title = noteOpen ? 'Close the note' : n ? 'Open the note' : 'Add a note';
}

function renderFocusNote() {
    const t = currentTask();
    noteBadge.hidden = !t;
    aesNoteBadge.hidden = !t;
    if (t) { fillBadge(noteBadge, t); fillBadge(aesNoteBadge, t); }
    focusNote.hidden = !t || !noteOpen;
    aesNote.hidden = !t || !noteOpen;
    if (t) { syncEditor(focusNoteInput, t); syncEditor(aesNoteInput, t); }
}

function toggleNote() {
    focusNoteInput.flushNote();
    aesNoteInput.flushNote();
    noteOpen = !noteOpen;
    store.set('noteOpen', noteOpen);
    renderFocusNote();
    const area = aesOpen ? aesNoteInput : focusNoteInput;
    if (noteOpen) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }
}

noteBadge.addEventListener('click', toggleNote);
aesNoteBadge.addEventListener('click', toggleNote);
[focusNoteInput, aesNoteInput].forEach((area) => {
    bindNoteEditor(area, currentTask);
    // Esc closes the note (not Aesthetic mode, not the tab)
    area.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); area.blur(); if (noteOpen) toggleNote(); }
    });
});

// Other tabs of this browser: open or closed
window.addEventListener('storage', (e) => {
    if (e.storageArea !== localStorage || e.key !== 'noteOpen') return;
    noteOpen = store.get('noteOpen', false) === true;
    renderFocusNote();
});

renderFocusNote();
