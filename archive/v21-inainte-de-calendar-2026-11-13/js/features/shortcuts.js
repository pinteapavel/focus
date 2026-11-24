// Clockus — keyboard shortcuts
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Keyboard shortcuts ----------
let swallowSpaceUp = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.body.classList.contains('clean')) setClean(false);
        else if (settingsPanel.classList.contains('open')) setPanel(false);
        else if (document.activeElement === taskInput) taskInput.blur();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    if (settingsPanel.classList.contains('open')) return;

    const key = e.key.toLowerCase();
    const onTimerTab = ['focus', 'todo'].includes(document.body.dataset.tab);

    if (e.key === ' ' && onTimerTab) {
        e.preventDefault();
        if (tag === 'BUTTON') swallowSpaceUp = true;
        if (running) pauseTimer();
        else startTimer();
    } else if (key === 'r' && onTimerTab) {
        resetTimer();
    } else if (key === 'f' && ['clock', 'focus'].includes(document.body.dataset.tab)) {
        setClean(!document.body.classList.contains('clean'));
    } else if (key === 'n') {
        e.preventDefault();
        showTab('todo');
        taskInput.focus();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && swallowSpaceUp) {
        e.preventDefault();
        swallowSpaceUp = false;
    }
});
