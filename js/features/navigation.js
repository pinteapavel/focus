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

// The new screen fades in, short; the old one is simply hidden at once (nothing overlaps)
const TAB_FADE_MS = 180;
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
    fadeIn(tab === 'focus' ? focusContainer : todoContainer, TAB_FADE_MS);
}

// What each tab shows, for the fade-in of the new tab
const tabParts = (tab) => ({
    clock: [realtimeEl, $('rt-date'), $('home-container')],
    focus: [clockEl, progressEl, focusContainer],
    todo: [clockEl, progressEl, todoContainer],
    calendar: [calContainerEl],
    stats: [statsContainer],
    settings: [settingsContainer]
}[tab] || []);

const TAB_NAMES = { clock: 'Home', focus: 'Focus', todo: 'To do', calendar: 'Calendar', stats: 'Stats', settings: 'Settings' };

function showTab(tab) {
    if (tab !== 'clock' && tab !== 'focus') setClean(false);
    const prev = document.body.dataset.tab;
    const floating = ui.animations && ((prev === 'focus' && tab === 'todo') || (prev === 'todo' && tab === 'focus'));
    // Every other change of tab: the old content is hidden at once (display: none, below) and the new one fades in.
    // Animations off: the change is instant.
    const fade = ui.animations && !floating && prev !== tab;
    if ((floating || fade) && window.scrollY > 0) window.scrollTo(0, 0);

    // Where things are right now (also correct if a previous glide is still running)
    const first = floating ? [clockEl, progressEl].map((el) => el.getBoundingClientRect()) : null;
    if (floating) {
        [clockEl, progressEl].forEach((el) => el.getAnimations && el.getAnimations().forEach((a) => a.cancel()));
    }

    const isClock = tab === 'clock';
    document.body.dataset.tab = tab;
    // The page's one <h1> names the open tab (hidden, for screen readers)
    $('tab-heading').textContent = TAB_NAMES[tab] || 'Clockus';
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
    if (fade) tabParts(tab).forEach((el) => fadeIn(el, TAB_FADE_MS));
}
clockTabBtn.addEventListener('click', () => showTab('clock'));
focusBtn.addEventListener('click', () => showTab('focus'));
todoBtn.addEventListener('click', () => showTab('todo'));
statsBtn.addEventListener('click', () => showTab('stats'));
calBtn.addEventListener('click', () => showTab('calendar'));
settingsTabBtn.addEventListener('click', () => showTab('settings'));
