// Clockus — toasts: one notification component for the whole app (board "Notifications")
// Loaded as a classic script (shared global scope), early, before the features that use it. Load order is set in app.html.
//
// showToast({ type, title, text, action, onClick, duration, timer, id }) → { close(), isOpen() }
// - type: 'success' | 'info' | 'warning' | 'error'. Each has its own icon (never only colour).
// - title: one line. text: an optional second, smaller line.
// - action: { label, run } — one button (Undo, Open…). onClick: the toast itself opens something.
// - duration (ms): success and info 4 s, with an action 6 s; warning and error stay (0) until closed or
//   until the code closes them (a warning goes away when the problem is fixed). Hovering pauses the countdown,
//   and the thin line at the bottom shows the time left.
// - id: a new toast with the same id replaces the old one (e.g. a second "Moved to…").
// - timer: a timer event. In Aesthetic mode only those show; the others wait hidden so the calm view stays calm.
// Where: centred, 14 px under the tab bar, over the page (it does not push anything). Phone: at the top,
// full width with a 10 px margin (the tab bar is at the bottom there). Aesthetic mode: top centre.
// At most 3 on screen, newest on top; the older ones get slightly smaller and dimmer; a 4th pushes the oldest out.
// Escape closes the newest. Screen readers: success and info politely, warning and error at once.

const TOAST_MAX = 3;
const TOAST_ICONS = {
    success: '<path d="M6 12.5l4 4 8-9"/>',
    info: '<path d="M12 11v6"/><path d="M12 7.5v.01"/>',
    warning: '<path d="M12 7v6"/><path d="M12 16.5v.01"/>',
    error: '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>'
};

const toastHost = document.createElement('div');
toastHost.className = 'toasts';
const toastPolite = document.createElement('div');
const toastAssertive = document.createElement('div');
toastPolite.className = toastAssertive.className = 'toast-sr';
toastPolite.setAttribute('aria-live', 'polite');
toastAssertive.setAttribute('aria-live', 'assertive');
document.body.append(toastHost, toastPolite, toastAssertive);

let toastList = [];   // newest first: { el, opts, left, end, paused, timer, closing }

function toastTop() {
    if (document.body.classList.contains('aesthetic') || window.matchMedia('(max-width: 600px)').matches) return null;
    const nav = document.querySelector('.topbar .nav');
    const r = nav && nav.getBoundingClientRect();
    return r && r.height ? Math.max(14, Math.round(r.bottom + 14)) : null;
}

function placeToasts() {
    toastHost.classList.toggle('still', !ui.animations);
    const top = toastTop();
    toastHost.style.top = top === null ? '' : `${top}px`;
    // The stack: newest on top, the older ones slide down, slightly smaller and dimmer
    let y = 0;
    const aes = document.body.classList.contains('aesthetic');
    toastList.filter((t) => !t.closing && (!aes || t.opts.timer)).forEach((t, i) => {
        t.el.style.setProperty('--y', `${y}px`);
        t.el.style.setProperty('--s', String(1 - i * 0.04));
        t.el.style.setProperty('--o', String(1 - i * 0.25));
        t.el.style.zIndex = String(TOAST_MAX - i);
        y += t.el.offsetHeight * (1 - i * 0.04) + 8;
    });
    toastHost.style.height = `${y}px`;
}

function announce(type, title, text) {
    const region = type === 'warning' || type === 'error' ? toastAssertive : toastPolite;
    region.textContent = '';
    setTimeout(() => { region.textContent = text ? `${title}. ${text}` : title; }, 50);
}

function tickToast(t) {
    clearTimeout(t.timer);
    if (!t.opts.duration || t.paused || t.closing) return;
    t.end = Date.now() + t.left;
    const bar = t.el.querySelector('.toast-bar i');
    if (bar) {
        bar.style.transition = 'none';
        bar.style.transform = `scaleX(${t.left / t.opts.duration})`;
        void bar.offsetWidth;
        bar.style.transition = `transform ${t.left}ms linear`;
        bar.style.transform = 'scaleX(0)';
    }
    t.timer = setTimeout(() => closeToast(t), t.left);
}

function pauseToast(t, on) {
    if (!t.opts.duration || t.closing || t.paused === on) return;
    t.paused = on;
    if (on) {
        clearTimeout(t.timer);
        t.left = Math.max(0, t.end - Date.now());
        const bar = t.el.querySelector('.toast-bar i');
        if (bar) {
            bar.style.transition = 'none';
            bar.style.transform = `scaleX(${t.left / t.opts.duration})`;
        }
    } else {
        tickToast(t);
    }
}

function closeToast(t) {
    if (!t || t.closing) return;
    t.closing = true;
    clearTimeout(t.timer);
    toastList = toastList.filter((x) => x !== t);
    const done = () => { t.el.remove(); placeToasts(); };
    if (ui.animations && t.el.animate && !t.el.hidden) {
        t.el.classList.add('out');
        t.el.addEventListener('transitionend', done, { once: true });
        setTimeout(done, 400);   // in case the transition does not run
    } else {
        done();
    }
    placeToasts();
    if (typeof t.opts.onClose === 'function') t.opts.onClose();
}

function showToast(o) {
    const opts = Object.assign({ type: 'info', title: '', text: '', timer: false }, o);
    if (!TOAST_ICONS[opts.type]) opts.type = 'info';
    if (opts.duration === undefined) {
        opts.duration = opts.type === 'warning' || opts.type === 'error' ? 0 : opts.action ? 6000 : 4000;
    }
    if (opts.id) closeToast(toastList.find((x) => x.opts.id === opts.id));

    const el = document.createElement('div');
    el.className = `toast toast-${opts.type}${opts.timer ? ' toast-timer' : ''}${opts.onClick ? ' toast-link' : ''}`;
    const icon = `<span class="toast-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOAST_ICONS[opts.type]}</svg></span>`;
    el.innerHTML = `${icon}<span class="toast-text"><span class="toast-title"></span><span class="toast-sub"></span></span>`;   // fixed markup; the texts are set below
    el.querySelector('.toast-title').textContent = opts.title;
    const sub = el.querySelector('.toast-sub');
    if (opts.text) sub.textContent = opts.text; else sub.remove();

    const t = { el, opts, left: opts.duration, end: 0, paused: false, timer: null, closing: false };
    if (opts.action) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'toast-action';
        b.textContent = opts.action.label;
        b.addEventListener('click', (e) => { e.stopPropagation(); closeToast(t); opts.action.run(); });
        el.append(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'toast-close';
    x.setAttribute('aria-label', 'Close');
    x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
    x.addEventListener('click', (e) => { e.stopPropagation(); closeToast(t); });
    el.append(x);
    if (opts.duration) {
        const bar = document.createElement('span');
        bar.className = 'toast-bar';
        bar.setAttribute('aria-hidden', 'true');
        bar.append(document.createElement('i'));
        el.append(bar);
    }
    if (opts.onClick) {
        el.addEventListener('click', () => { closeToast(t); opts.onClick(); });
        if (opts.label) el.setAttribute('aria-label', opts.label);
    }
    el.addEventListener('mouseenter', () => pauseToast(t, true));
    el.addEventListener('mouseleave', () => pauseToast(t, false));
    el.addEventListener('focusin', () => pauseToast(t, true));
    el.addEventListener('focusout', () => pauseToast(t, false));

    toastList.unshift(t);
    toastHost.prepend(el);
    while (toastList.length > TOAST_MAX) closeToast(toastList[toastList.length - 1]);   // a 4th pushes the oldest out
    if (ui.animations) {
        el.classList.add('in');
        void el.offsetWidth;   // the start position is laid out first, so the slide in runs
        setTimeout(() => el.classList.remove('in'), 20);   // a timer, not an animation frame: those stop in a hidden tab
    }
    placeToasts();
    // Aesthetic mode: only timer events are shown (the others are hidden, not lost)
    if (!document.body.classList.contains('aesthetic') || opts.timer) announce(opts.type, opts.title, opts.text);
    tickToast(t);
    return { close: () => closeToast(t), isOpen: () => toastList.includes(t) };
}

// Escape closes the newest toast that is on screen (before any other use of the key)
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.goals-modal:not([hidden]), .fb-modal:not([hidden])')) return;
    const aes = document.body.classList.contains('aesthetic');
    const t = toastList.find((x) => !x.closing && (!aes || x.opts.timer));
    if (!t) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    closeToast(t);
}, true);

window.addEventListener('resize', placeToasts);
window.addEventListener('scroll', () => { if (toastList.length) placeToasts(); }, { passive: true });
// Entering or leaving Aesthetic mode moves the stack (top centre there)
new MutationObserver(placeToasts).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-tab'] });
