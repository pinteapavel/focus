// Clockus — start-up: runs last, after every other script has loaded
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Init ----------
focusInput.value = settings.focus;
breakInput.value = settings.brk;
pruneFocus();
restoreTimer();
render();
renderTasks();
updateStats();
showTab('clock'); // the app opens on the Home tab (still called 'clock' inside the code)
