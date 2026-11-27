// Clockus — tab navigation (Clock / Focus / To do / Stats) and tab animations
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Navigation ----------
// The frosted glass (backdrop-filter, css/glass.css) goes flat or flickers when a parent fades: the parent cuts it off
// from the page behind. So a tab is never faded as one block. fadeParts() returns what to animate instead: every glass
// element (it fades by itself, blur included), and every part with no glass inside it. Containers that hold glass
// are never animated.
function hasGlass(el) {
    const cs = getComputedStyle(el);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    return !!bf && bf !== 'none';
}

function fadeParts(root) {
    if (hasGlass(root)) return [root];
    const glass = new Set([...root.querySelectorAll('*')].filter(hasGlass));
    if (!glass.size) return [root];
    const holders = new Set();   // the elements between the root and a glass element
    glass.forEach((g) => { for (let p = g.parentElement; p && p !== root; p = p.parentElement) holders.add(p); });
    const parts = [];
    const walk = (el) => {
        for (const c of el.children) {
            if (holders.has(c) && !glass.has(c)) walk(c);
            else parts.push(c);
        }
    };
    walk(root);
    return parts;
}

function fadeIn(root, duration) {
    fadeParts(root).forEach((el) => el.animate && el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' }));
}

// Focus <-> To do: the clock (and its line) glide to the new position instead of jumping
function floatClock(first, tab) {
    [clockEl, progressEl].forEach((el, i) => {
        if (!el.animate) return;
        const last = el.getBoundingClientRect();
        if (!last.width || !last.height) return;
        const f = first[i];
        el.animate([
            {
                transformOrigin: 'top left',
                transform: `translate(${f.left - last.left}px, ${f.top - last.top}px) scale(${f.width / last.width}, ${f.height / last.height})`
            },
            { transformOrigin: 'top left', transform: 'none' }
        ], { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
    fadeIn(tab === 'focus' ? focusContainer : todoContainer, 400);
}

// A visual copy of something that is about to disappear, so it can fade out in place
function ghostOf(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const cs = getComputedStyle(el);
    const g = el.cloneNode(true);
    g.removeAttribute('id');
    g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    Object.assign(g.style, {
        position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        // keep its own layout (Home's column is flex, so the capsule stays centred while it fades)
        margin: '0', display: cs.display === 'none' ? 'block' : cs.display, zIndex: '5', pointerEvents: 'none',
        fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color, textAlign: cs.textAlign
    });
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    document.body.append(g);
    return g;
}

// The copy fades part by part too (see fadeParts): its glass keeps its blur until it is gone
function fadeOutAndRemove(g) {
    fadeParts(g).forEach((el) => el.animate && el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }));
    setTimeout(() => g.remove(), 320);
}

// What each tab shows, for the crossfade between tabs
const tabParts = (tab) => ({
    clock: [realtimeEl, $('rt-date'), $('home-container')],
    focus: [clockEl, progressEl, focusContainer],
    todo: [clockEl, progressEl, todoContainer],
    calendar: [calContainerEl],
    stats: [statsContainer],
    settings: [settingsContainer]
}[tab] || []);

function showTab(tab) {
    if (tab !== 'clock' && tab !== 'focus') setClean(false);
    const prev = document.body.dataset.tab;
    const floating = ui.animations && ((prev === 'focus' && tab === 'todo') || (prev === 'todo' && tab === 'focus'));
    // Every other change of tab: the old content fades out while the new one fades in
    const crossfade = ui.animations && !floating && prev !== tab;

    // Copies of what is leaving, taken where it is on screen right now (before scrolling to the top)
    const ghosts = crossfade ? tabParts(prev).map(ghostOf).filter(Boolean) : [];
    if ((floating || crossfade) && window.scrollY > 0) window.scrollTo(0, 0);

    // Where things are right now (also correct if a previous glide is still running)
    const first = floating ? [clockEl, progressEl].map((el) => el.getBoundingClientRect()) : null;
    if (floating) {
        [clockEl, progressEl].forEach((el) => el.getAnimations && el.getAnimations().forEach((a) => a.cancel()));
    }

    const isClock = tab === 'clock';
    document.body.dataset.tab = tab;
    clockTabBtn.classList.toggle('active', isClock);
    focusBtn.classList.toggle('active', tab === 'focus');
    todoBtn.classList.toggle('active', tab === 'todo');
    statsBtn.classList.toggle('active', tab === 'stats');
    calBtn.classList.toggle('active', tab === 'calendar');
    settingsTabBtn.classList.toggle('active', tab === 'settings');
    // screen readers hear which tab is open (the others show only an icon)
    [clockTabBtn, focusBtn, todoBtn, statsBtn, calBtn, settingsTabBtn].forEach((b) => {
        if (b.classList.contains('active')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    settingsContainer.style.display = tab === 'settings' ? 'block' : 'none';
    if (tab === 'settings') { delete settingsContainer.dataset.open; markSettingsNav('appearance'); renderSettingsSummary(); renderSyncWhen(); }
    // The timer display is shown on Focus and To do; Clock and Stats have their own content
    const showTimer = tab === 'focus' || tab === 'todo';
    realtimeEl.style.display = isClock ? 'block' : 'none';
    if (typeof onHomeTab === 'function') onHomeTab();   // Home: date, Up next, chips, background (home.js)
    clockEl.style.display = showTimer ? 'block' : 'none';
    progressEl.style.display = showTimer ? 'block' : 'none';
    statsContainer.style.display = tab === 'stats' ? 'block' : 'none';
    if (tab === 'stats') {
        renderStats();
        mapTip.hidden = true;
        mapWrap.scrollLeft = mapWrap.scrollWidth; // narrow screens: start at the latest weeks
    }
    calContainerEl.style.display = tab === 'calendar' ? 'block' : 'none';
    if (tab === 'calendar') renderCalendar();
    focusContainer.style.display = tab === 'focus' ? 'block' : 'none';
    todoContainer.style.display = tab === 'todo' ? 'block' : 'none';

    // An empty To do list: the cursor waits in "Add a task…", ready for the first task
    if (tab === 'todo' && prev !== 'todo' && !tasks.some(onTodoList)) taskInput.focus({ preventScroll: true });

    if (first) floatClock(first, tab);
    if (crossfade) {
        ghosts.forEach(fadeOutAndRemove);
        tabParts(tab).forEach((el) => fadeIn(el, 450));
    }
}
clockTabBtn.addEventListener('click', () => showTab('clock'));
focusBtn.addEventListener('click', () => showTab('focus'));
todoBtn.addEventListener('click', () => showTab('todo'));
statsBtn.addEventListener('click', () => showTab('stats'));
calBtn.addEventListener('click', () => showTab('calendar'));
settingsTabBtn.addEventListener('click', () => showTab('settings'));
