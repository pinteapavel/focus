// Clockus — To do list: drag & drop reordering
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Reorder tasks (drag & drop) ----------
let drag = null;
let suppressClick = false;

todoList.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('.todo-item');
    if (!li || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const onHandle = e.target.closest('.drag-handle');
    const mouseGrab = e.pointerType === 'mouse' && !e.target.closest('input, button');
    if (!onHandle && !mouseGrab) return;
    drag = { li, id: Number(li.dataset.id), startY: e.clientY, active: false, index: 0 };
});

document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
        if (Math.abs(dy) < 6) return;
        drag.active = true;
        drag.li.classList.add('dragging');
        todoList.classList.add('is-dragging');
    }
    e.preventDefault();
    drag.li.style.transform = `translateY(${dy}px)`;

    const others = [...todoList.querySelectorAll('.todo-item')].filter((x) => x !== drag.li);
    let idx = others.findIndex((x) => {
        const r = x.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
    });
    if (idx === -1) idx = others.length;
    drag.index = idx;
    others.forEach((x, i) => {
        x.classList.toggle('drop-before', i === idx);
        x.classList.toggle('drop-after', idx === others.length && i === others.length - 1);
    });
});

function endDrag(cancel) {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.li.classList.remove('dragging');
    d.li.style.transform = '';
    todoList.classList.remove('is-dragging');
    todoList.querySelectorAll('.drop-before, .drop-after')
        .forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    if (!d.active) return;

    // The click that follows a drag must not toggle the task
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancel) return;

    const from = tasks.findIndex((t) => t.id === d.id);
    if (from < 0) return;
    const [moved] = tasks.splice(from, 1);
    tasks.splice(d.index, 0, moved);
    renderTasks();
    pushSettings();
}

document.addEventListener('pointerup', () => endDrag(false));
document.addEventListener('pointercancel', () => endDrag(true));
todoList.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
}, true);
