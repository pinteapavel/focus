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

function renderTasks() {
    // Done tasks stay (crossed out) for the rest of the day, then disappear
    const stale = tasks.filter((t) => t.done && t.doneOn !== today());
    if (stale.length) {
        tasks = tasks.filter((t) => !stale.includes(t));
        cloudDelete(stale.map((t) => t.id));
    }
    tasks = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)];
    saveTasks();
    // A finished or deleted task can no longer be the current one
    if (currentTaskId !== null && !tasks.some((t) => t.id === currentTaskId && !t.done)) {
        currentTaskId = null;
        store.set('currentTask', null);
    }
    updateCurrentLine();
    todoList.replaceChildren();

    if (!tasks.length) {
        const li = document.createElement('li');
        li.className = 'todo-empty';
        li.textContent = 'Nothing planned yet.';
        todoList.append(li);
        return;
    }

    tasks.forEach((t) => {
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

        li.append(handle, label, cur, edit, del);
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
    const task = { id: Date.now(), text, done: false, doneOn: null };
    tasks.push(task);
    taskInput.value = '';
    renderTasks();
    cloudUpsert(task);
}

todoList.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const id = Number(e.target.closest('li').dataset.id);
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = e.target.checked;
    t.doneOn = t.done ? today() : null;
    if (t.done) {
        // Completed: goes to the very bottom of the list
        tasks = tasks.filter((x) => x !== t);
        tasks.push(t);
    }
    renderTasks();
    cloudUpsert(t);
    pushSettings();
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
