// Clockus — keyboard shortcuts
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Keyboard shortcuts ----------
let swallowSpaceUp = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.body.classList.contains('clean')) setClean(false);
        else if (settingsContainer.dataset.open) closeSettingsSection();   // phone: back to the Settings list
        else if (document.activeElement === taskInput) taskInput.blur();
        else if (document.activeElement === $('day-input')) $('day-input').blur();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

    const key = e.key.toLowerCase();
    const onTimerTab = ['focus', 'todo'].includes(document.body.dataset.tab);

    if (e.key === ' ' && onTimerTab) {
        e.preventDefault();
        if (tag === 'BUTTON') swallowSpaceUp = true;
        if (running) pauseTimer();
        else startTimer();
    } else if (key === 'r' && onTimerTab) {
        resetTimer();
    } else if (key === 's' && ['clock', 'focus', 'todo'].includes(document.body.dataset.tab) && mode === 'break') {
        skipBreak();
    } else if (key === 'f' && ['clock', 'focus'].includes(document.body.dataset.tab)) {
        setClean(!document.body.classList.contains('clean'));
    } else if (document.body.dataset.tab === 'calendar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        calStep(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (key === 't' && document.body.dataset.tab === 'calendar') {
        calToday();
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
