// Clockus — digit motion: on the Home clock and the Focus timer only the digit that changes moves.
// The new digit comes in blurred and sharpens; the old one blurs and fades at the same moment, in the same place.
// With Animations off, or when the device asks for reduced motion, digits change instantly.
// Loaded as a classic script (shared global scope). Load order is set in app.html.

const dmReduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const digitMotionOn = () => ui.animations && !(dmReduceMq && dmReduceMq.matches);

// Writes `text` into `el`, one span per character. The element's textContent always stays exactly `text`
// (the old digit is drawn by CSS from data-old), so whatever reads the clock text keeps working.
function setDigits(el, text) {
    const cells = el.children;
    const same = cells.length === text.length && el.textContent.length === text.length;
    if (!same) {
        // First draw, or the shape changed (seconds on/off, 9:59 → 10:00 on a long timer): no motion
        el.textContent = '';
        for (const ch of text) {
            const c = document.createElement('span');
            c.className = 'dm';
            c.textContent = ch;
            el.appendChild(c);
        }
        return;
    }
    const animate = digitMotionOn() && !document.hidden;
    for (let i = 0; i < text.length; i++) {
        const c = cells[i];
        const prev = c.textContent;
        if (prev === text[i]) continue;
        c.textContent = text[i];
        c.classList.remove('dm-go');
        if (!animate) continue;
        c.dataset.old = prev;
        c.dataset.new = text[i];
        void c.offsetWidth;   // restart the animation if the digit changed again before it ended
        c.classList.add('dm-go');
    }
}

document.addEventListener('animationend', (e) => {
    const c = e.target;
    if (c.classList && c.classList.contains('dm-go') && e.animationName === 'dm-hold') c.classList.remove('dm-go');
});
