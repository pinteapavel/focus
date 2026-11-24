// Clockus — clean mode: only the big digits and the progress line
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Clean mode: only the big digits and the progress line ----------
const cleanBtn = $('clean-btn');
let cleanTimer = null;

function revealCleanBtn() {
    document.body.classList.add('show-exit');
    clearTimeout(cleanTimer);
    cleanTimer = setTimeout(() => document.body.classList.remove('show-exit'), 2500);
}

function setClean(on) {
    if (on && !['clock', 'focus'].includes(document.body.dataset.tab)) return;
    document.body.classList.toggle('clean', on);
    document.body.classList.remove('show-exit');
    const label = on ? 'Exit clean mode (F)' : 'Clean mode (F)';
    cleanBtn.setAttribute('aria-label', label);
    cleanBtn.title = label;
    cleanBtn.setAttribute('aria-pressed', String(on));
    if (on) revealCleanBtn();
    // Clean mode chosen on Focus: Home goes back to the plain background (home.js)
    if (on && document.body.dataset.tab === 'focus' && typeof homeRememberLook === 'function') homeRememberLook(false);
}

cleanBtn.addEventListener('click', () => setClean(!document.body.classList.contains('clean')));
// Moving the mouse or touching the screen shows the exit button for a moment
['pointermove', 'pointerdown'].forEach((type) => document.addEventListener(type, () => {
    if (document.body.classList.contains('clean')) revealCleanBtn();
}));
// Double click / double tap on the digits starts or pauses the timer while the controls are hidden
clockEl.addEventListener('dblclick', () => {
    if (!document.body.classList.contains('clean') || document.body.dataset.tab !== 'focus') return;
    if (running) pauseTimer();
    else startTimer();
});
