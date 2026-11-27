// Clockus — To do list: add, edit, complete, delete, current task
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- To do ----------
let tasks = store.get('tasks', []);
let lastDay = today();

// The task you are working on right now (shown under the timer on the Focus tab)
let currentTaskId = store.get('currentTask', null);
const currentLine = $('current-line');
const CUR_ICON = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M51.92 48.71A26 26 0 1 1 51.92 15.29" stroke-width="5" stroke-linecap="round"/><circle cx="58" cy="32" r="6"/></svg>';

function updateCurrentLine() {
    const t = tasks.find((x) => x.id === currentTaskId && !x.done);
    currentLine.replaceChildren();
    if (t) {
        currentLine.append('Working on: ', makeEl('b', '', t.text));
        currentLine.title = 'Change the task';
    } else {
        currentLine.textContent = 'Pick a task, or just press Start.';
        currentLine.title = 'Open your to-do list';
    }
}

function setCurrentTask(id) {
    currentTaskId = id;
    store.set('currentTask', id);
    renderTasks();
}

function saveTasks() { store.set('tasks', tasks); }

// The top priority task: only one, pinned first in To do, and the one the reminder shows (reminders.js)
let topPriorityId = store.get('topPriority', null);
const FLAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4M6 4h11l-2.5 4.5L17 13H6"/></svg>';

function setTopPriority(id) {
    topPriorityId = id;
    store.set('topPriority', id);
    if (typeof onTopPriorityChange === 'function') onTopPriorityChange();
    renderTasks();
}

// Done tasks stay (crossed out) for the rest of the day, then leave the list. Those with a day
// in the calendar are kept (hidden here) for a year, so the calendar still shows them as done.
const hiddenDone = (t) => t.done && t.doneOn !== today();

// To do is the one list: every task, with or without a day. A day only puts it in the Calendar too.
const onTodoList = (t) => !hiddenDone(t);

// Before the Calendar, every task in To do was "for now": give the open ones without a day today's date,
// once, so they stay in the list. Also used when the cloud holds tasks saved by an older version.
function giveUndatedToday() {
    const k = dayKey();
    // pAt 1: older than any real change, so a choice made on another device still wins
    tasks.forEach((t) => { if (!t.done && !t.date) { t.date = k; t.pAt = t.pAt || 1; } });
}
if (!store.get('todoIsToday', false)) {
    giveUndatedToday();
    store.set('todoIsToday', true);
    saveTasks();
}

// At the end of the day, open tasks without a day leave the list too; those with a day stay, with their chip
// ("Yesterday", "Fri 20"). A task counts from when it was added or lost its day (pAt); tasks that were already
// in the list when this rule arrived count from that moment, so none disappear the first time.
let todoDailySince = Number(store.get('todoDailySince', 0));
if (!todoDailySince) { todoDailySince = Date.now(); store.set('todoDailySince', todoDailySince); }
const endedUndated = (t) => !t.done && !t.date
    && dayKey(new Date(Math.max(Number(t.id) || 0, Number(t.pAt) || 0, todoDailySince))) < dayKey();

function renderTasks() {
    const yearAgo = dayKey(dateAgo(365));
    const stale = tasks.filter((t) => (hiddenDone(t) && (!t.date || t.date < yearAgo)) || endedUndated(t));
    if (stale.length) {
        tasks = tasks.filter((t) => !stale.includes(t));
        cloudDelete(stale.map((t) => t.id));
    }
    // A completed or deleted task loses the top priority flag (and the reminders stop)
    if (topPriorityId !== null && !tasks.some((t) => t.id === topPriorityId && !t.done)) {
        topPriorityId = null;
        store.set('topPriority', null);
    }
    // The list: the top priority task, then open, then done; then the hidden done ones
    // (list positions match the array, so drag-to-reorder keeps working)
    const isTop = (t) => t.id === topPriorityId;
    tasks = [
        ...tasks.filter((t) => onTodoList(t) && !t.done && isTop(t)),
        ...tasks.filter((t) => onTodoList(t) && !t.done && !isTop(t)),
        ...tasks.filter((t) => onTodoList(t) && t.done),
        ...tasks.filter((t) => !onTodoList(t))
    ];
    saveTasks();
    // A finished or deleted task can no longer be the current one
    if (currentTaskId !== null && !tasks.some((t) => t.id === currentTaskId && !t.done)) {
        currentTaskId = null;
        store.set('currentTask', null);
    }
    updateCurrentLine();
    refreshCalendar();
    refreshGoals();
    todoList.replaceChildren();

    // Search and filters (task-notes.js): only the matching tasks, the matches highlighted
    const all = tasks.filter(onTodoList);
    const visible = typeof filterTodo === 'function' ? filterTodo(all) : all;
    if (typeof afterTodoFilter === 'function') afterTodoFilter(visible.length);
    if (!visible.length) {
        const li = document.createElement('li');
        li.className = 'todo-empty';
        li.textContent = all.length && typeof todoEmptyText === 'function' ? todoEmptyText() : 'Nothing here yet. Add your first task and start a focus session.';
        todoList.append(li);
        return;
    }

    visible.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (t.done ? ' done' : '') + (t.id === currentTaskId ? ' current' : '') + (isTop(t) ? ' top' : '');
        li.dataset.id = t.id;

        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.done;
        const text = document.createElement('span');
        if (typeof fillMatch === 'function') fillMatch(text, t.text); else text.textContent = t.text;
        label.append(cb, text);

        // The date chip ("Today", "Fri 20"), or "+ Set date"; done tasks show none
        const due = document.createElement('button');
        due.type = 'button';
        due.className = 'due-btn' + (t.date ? ' set' : ' add');
        due.hidden = t.done;
        due.textContent = t.date ? dueLabel(t) : '+ Set date';
        due.title = t.date ? 'Change the date' : 'Set a date';
        due.setAttribute('aria-label', t.date ? `Date of ${t.text}: ${dueLabel(t)}. Change` : `Set a date for ${t.text}`);

        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.textContent = 'Delete';
        del.setAttribute('aria-label', `Delete ${t.text}`);

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '\u283F';
        handle.title = 'Drag to reorder';
        handle.setAttribute('aria-hidden', 'true');

        const edit = document.createElement('button');
        edit.className = 'edit-btn';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', `Edit ${t.text}`);

        const cur = document.createElement('button');
        cur.className = 'cur-btn';
        cur.innerHTML = CUR_ICON;   // fixed markup, no user text
        cur.disabled = t.done;
        cur.setAttribute('aria-pressed', String(t.id === currentTaskId));
        cur.setAttribute('aria-label', t.id === currentTaskId ? `Stop working on ${t.text}` : `Work on ${t.text}`);
        cur.title = t.id === currentTaskId ? 'Current task' : 'Work on this task';

        // Text and day together: on a phone the day wraps under the text
        const main = document.createElement('div');
        main.className = 'todo-main';
        main.append(label, due);
        // The note: a small icon and its first line; a click opens the task with its note (task-notes.js)
        if (typeof noteLineEl === 'function') { const nl = noteLineEl(t); if (nl) main.append(nl); }
        if (typeof isTaskOpen === 'function' && isTaskOpen(t.id)) li.classList.add('open');

        // Top priority: the flag on the current one (click removes it), "Set as top priority" on hover for the others
        const prio = document.createElement('button');
        prio.type = 'button';
        prio.className = 'prio-btn' + (isTop(t) ? ' on' : '');
        prio.hidden = t.done;
        prio.innerHTML = FLAG_ICON;   // fixed markup, no user text
        prio.append(makeEl('span', 'prio-text', isTop(t) ? 'Top priority' : 'Set as top priority'));
        prio.setAttribute('aria-pressed', String(isTop(t)));
        prio.setAttribute('aria-label', isTop(t) ? `Remove top priority from ${t.text}` : `Set ${t.text} as top priority`);
        prio.title = isTop(t) ? 'Remove top priority' : 'Set as top priority';

        // Open: the side panel with the task and its note
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'note-btn' + (t.note ? ' has' : '');
        open.textContent = 'Note';
        open.setAttribute('aria-label', t.note ? `Open the note of ${t.text}` : `Add a note to ${t.text}`);
        open.title = t.note ? 'Open the note' : 'Add a note';

        li.append(handle, main, prio, cur, open, edit, del);
        todoList.append(li);
    });
}

function startEdit(li, t) {
    const label = li.querySelector('label');
    if (!label) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.maxLength = 120;
    input.value = t.text;
    input.setAttribute('aria-label', 'Edit task');
    label.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (save) => {
        if (finished) return;
        finished = true;
        const value = input.value.trim();
        if (save && value && value !== t.text) {
            t.text = value;
            renderTasks();
            cloudUpsert(t);
        } else {
            renderTasks();
        }
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    const task = { id: Date.now(), text, done: false, doneOn: null, pAt: Date.now() };   // no date until you set one
    tasks.push(task);
    taskInput.value = '';
    renderTasks();
    cloudUpsert(task);
    pushSettings();
}

// Used by the To do list and the Calendar
function setTaskDone(t, done) {
    t.done = done;
    t.doneOn = done ? today() : null;
    if (done) {
        // Completed: goes to the very bottom of the list
        tasks = tasks.filter((x) => x !== t);
        tasks.push(t);
    }
    renderTasks();
    cloudUpsert(t);
    pushSettings();
}

todoList.addEventListener('change', (e) => {
    const li = e.target.closest('li');
    const t = li && tasks.find((x) => x.id === Number(li.dataset.id));
    if (!t) return;
    if (e.target.type === 'checkbox') setTaskDone(t, e.target.checked);
});

todoList.addEventListener('click', (e) => {
    const btn = e.target.closest('.due-btn');
    if (!btn) return;
    const t = tasks.find((x) => x.id === Number(btn.closest('li').dataset.id));
    if (t) openDatePicker(btn, t.date, (date) => planTask(t, date));
});

todoList.addEventListener('click', (e) => {
    const prioBtn = e.target.closest('.prio-btn');
    if (prioBtn) {
        const id = Number(prioBtn.closest('li').dataset.id);
        setTopPriority(topPriorityId === id ? null : id);
        return;
    }
    const curBtn = e.target.closest('.cur-btn');
    if (curBtn) {
        const id = Number(curBtn.closest('li').dataset.id);
        setCurrentTask(currentTaskId === id ? null : id);
        return;
    }
    if (e.target.classList.contains('edit-btn')) {
        const li = e.target.closest('li');
        const t = tasks.find((x) => x.id === Number(li.dataset.id));
        if (t) startEdit(li, t);
        return;
    }
    if (!e.target.classList.contains('delete-btn')) return;
    const id = Number(e.target.closest('li').dataset.id);
    tasks = tasks.filter((x) => x.id !== id);
    renderTasks();
    cloudDelete([id]);
});

currentLine.addEventListener('click', () => showTab('todo'));
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
});

// New day (e.g. page left open past midnight): clear yesterday's done tasks and open tasks without a day
setInterval(() => {
    if (today() !== lastDay) {
        lastDay = today();
        renderTasks();
    }
}, 60000);
