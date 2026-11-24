// Clockus — Clock tab: the current time (also applies the saved appearance on load)
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Current time ----------
function updateRealtime() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    let h = d.getHours();
    let suffix = '';
    if (ui.format === '12') {
        suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
    }
    rtMain.textContent = `${p(h)}:${p(d.getMinutes())}`;
    rtSec.textContent = ui.seconds ? `:${p(d.getSeconds())}` : '';
    rtAmpm.textContent = suffix;
}
setInterval(updateRealtime, 250);
applyUi();
