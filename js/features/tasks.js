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
        currentLine.textContent = 'Pick a task to work on';
        currentLine.title = 'Open your to-do list';
    }
}

function setCurrentTask(id) {
    currentTaskId = id;
    store.set('currentTask', id);
    renderTasks();
}

function saveTasks() { store.set('tasks', tasks); }

const todoNote = $('todo-note');
todoNote.addEventListener('click', () => showTab('calendar'));

// Done tasks stay (crossed out) for the rest of the day, then leave the list. Those with a day
// in the calendar are kept (hidden here) for a year, so the calendar still shows them as done.
const hiddenDone = (t) => t.done && t.doneOn !== today();

// The To do list is TODAY's list: tasks planned for today, plus unfinished ones from earlier days.
// Tasks for later days, or with no day, live in the Calendar until then.
const onTodayList = (t) => !!t.date && t.date <= dayKey() && !hiddenDone(t);

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

function renderTasks() {
    const yearAgo = dayKey(dateAgo(365));
    const stale = tasks.filter((t) => hiddenDone(t) && (!t.date || t.date < yearAgo));
    if (stale.length) {
        tasks = tasks.filter((t) => !stale.includes(t));
        cloudDelete(stale.map((t) => t.id));
    }
    // Today's list first: open, then done; then everything else
    // (list positions match the array, so drag-to-reorder keeps working)
    tasks = [
        ...tasks.filter((t) => onTodayList(t) && !t.done),
        ...tasks.filter((t) => onTodayList(t) && t.done),
        ...tasks.filter((t) => !onTodayList(t))
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

    const visible = tasks.filter(onTodayList);
    const later = tasks.filter((t) => !t.done && (!t.date || t.date > dayKey())).length;
    todoNote.hidden = !later;
    todoNote.textContent = later ? `${later} more ${later === 1 ? 'task is' : 'tasks are'} planned for other days. See Calendar` : '';
    if (!visible.length) {
        const li = document.createElement('li');
        li.className = 'todo-empty';
        li.textContent = 'Nothing for today yet.';
        todoList.append(li);
        return;
    }

    visible.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'todo-item' + (t.done ? ' done' : '') + (t.id === currentTaskId ? ' current' : '');
        li.dataset.id = t.id;

        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.done;
        const text = document.createElement('span');
        text.textContent = t.text;
        label.append(cb, text);

        // When: today's tasks show their time (or a clock to give them one), late ones their day
        const late = isOverdue(t);
        const due = document.createElement('button');
        due.type = 'button';
        due.className = 'due-btn' + (t.time || late ? ' set' : '') + (late ? ' late' : '');
        if (late) due.textContent = `Late · ${dueLabel(t)}`;
        else if (t.time) due.textContent = `${t.time} · ${fmtLen(t.dur || DEFAULT_DUR)}`;
        else due.innerHTML = CLOCK_ICON;   // fixed markup, no user text
        due.title = 'Change day and time';
        due.setAttribute('aria-label', `Change day and time of ${t.text}` + (t.time ? `, now ${t.time}` : ''));

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

        li.append(handle, main, cur, edit, del);
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
    const task = { id: Date.now(), text, done: false, doneOn: null, date: dayKey(), pAt: Date.now() };   // To do = today
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
    if (t) openPlanPicker(btn, { date: t.date, time: t.time, dur: t.dur, excludeId: t.id }, (date, time, dur) => planTask(t, date, time, dur));
});

todoList.addEventListener('click', (e) => {
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

// New day (e.g. page left open past midnight): clear yesterday's done tasks
setInterval(() => {
    if (today() !== lastDay) {
        lastDay = today();
        renderTasks();
    }
}, 60000);
