// Clockus — Stats tab: cards, streak, chart and the yearly focus map
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Stats dashboard ----------
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rangeBtns = document.querySelectorAll('.range-btn');
let statsRange = 'week';
let statsTimer = null;

// n days before today, at noon (avoids daylight-saving edge cases)
function dateAgo(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

function totalsByDay() {
    const totals = {};
    for (const days of Object.values(focusLog)) {
        for (const [day, ms] of Object.entries(days)) totals[day] = (totals[day] || 0) + ms;
    }
    return totals;
}

function shortDuration(ms) {
    const total = Math.floor(ms / 60000);
    if (!total) return '0';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? (m ? `${h}h${pad2(m)}` : `${h}h`) : `${m}m`;
}

function makeEl(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function renderStatsSoon() {
    if (statsTimer) return;
    statsTimer = setTimeout(() => { statsTimer = null; renderStats(); }, 1000);
}

const HOUR_MS = 3600000;

// Streak = consecutive days with 1h+ of focus. If today has not reached 1h yet,
// the streak is still alive and counts back from yesterday ("at risk" until midnight).
function renderStreak(ms) {
    const todayCounted = ms(dateAgo(0)) >= HOUR_MS;
    const startOffset = todayCounted ? 0 : 1;
    let n = 0;
    while (n < 365 && ms(dateAgo(startOffset + n)) >= HOUR_MS) n++;

    let best = 0;
    let run = 0;
    for (let i = 364; i >= 0; i--) {
        if (ms(dateAgo(i)) >= HOUR_MS) { run++; best = Math.max(best, run); } else run = 0;
    }
    const savedBest = store.get('bestStreak', 0);
    best = Math.max(best, savedBest, n);
    if (best > savedBest) store.set('bestStreak', best);

    const state = n > 0 ? (todayCounted ? 'lit' : 'risk') : 'out';
    $('streak-n').textContent = n;
    $('streak-unit').textContent = n === 1 ? ' day' : ' days';
    $('streak-best').textContent = `Best: ${best} ${best === 1 ? 'day' : 'days'}`;
    $('streak-note').textContent = state === 'lit' ? 'Today counted'
        : state === 'risk' ? 'Focus 1h today to keep it'
        : best > 0 ? 'Streak ended. Start a new one' : 'Focus 1h to start a streak';
    $('streak-flame').setAttribute('class', `flame ${state === 'lit' ? '' : state}`.trim());
    $('streak-card').classList.toggle('out', state === 'out');

    // This week, Monday first: filled = counted, ring = today
    const offset = (dateAgo(0).getDay() + 6) % 7;
    const dots = $('streak-dots');
    dots.replaceChildren();
    'MTWTFSS'.split('').forEach((letter, i) => {
        const d = dateAgo(offset - i);
        const day = makeEl('div', 'streak-day');
        day.append(makeEl('span', 'streak-dot' + (ms(d) >= HOUR_MS ? ' on' : '') + (i === offset ? ' today' : '')));
        day.append(document.createTextNode(letter));
        dots.append(day);
    });

    // day -> position inside the current streak (1 = first day), for the map
    const map = {};
    for (let k = 0; k < n; k++) map[dayKey(dateAgo(startOffset + k))] = n - k;
    return map;
}

function renderStats() {
    renderGoals();
    const totals = totalsByDay();
    // No focus session yet: a line above the zero figures, and a button to the Focus tab
    $('stats-first').hidden = sessions.length > 0 || Object.values(totals).some((v) => v > 0);
    const ms = (d) => totals[dayKey(d)] || 0;
    const now = dateAgo(0);
    const month = statsRange === 'month';

    // Cards
    const today = ms(now);
    const diff = today - ms(dateAgo(1));
    $('sc-today').textContent = fmtDuration(today);
    $('sc-today-sub').textContent = !today && !ms(dateAgo(1)) ? 'No focus yet'
        : Math.abs(diff) < 60000 ? 'Same as yesterday'
        : `${diff > 0 ? '+' : '-'}${fmtDuration(Math.abs(diff))} vs yesterday`;

    const elapsed = month ? now.getDate() : ((now.getDay() + 6) % 7) + 1;
    let sum = 0;
    for (let i = 0; i < elapsed; i++) sum += ms(dateAgo(i));
    $('sc-period-label').textContent = month ? 'This month' : 'This week';
    $('sc-period').textContent = fmtDuration(sum);
    $('sc-period-sub').textContent = `avg ${fmtDuration(sum / elapsed)} / day`;
    const streakMap = renderStreak(ms);
    renderRecords(totals);

    // Chart: last 7 or 30 days
    const span = month ? 30 : 7;
    const bars = [];
    for (let i = span - 1; i >= 0; i--) {
        const d = dateAgo(i);
        bars.push({ d, v: ms(d), today: i === 0 });
    }
    const maxV = Math.max(...bars.map((b) => b.v), 3600000);
    const chart = $('chart');
    chart.replaceChildren();
    chart.classList.toggle('month', month);
    bars.forEach((b, idx) => {
        const col = makeEl('div', 'chart-col' + (b.today ? ' today' : ''));
        col.append(makeEl('span', 'chart-val', shortDuration(b.v)));
        const bar = makeEl('div', 'chart-bar');
        bar.style.height = Math.max(3, Math.round((b.v / maxV) * 110)) + 'px';
        col.append(bar);
        const label = month ? (idx % 5 === 4 ? String(b.d.getDate()) : '') : DAY_NAMES[b.d.getDay()];
        col.append(makeEl('span', 'chart-lbl', label));
        chart.append(col);
    });
    $('chart-title').textContent = month ? 'Last 30 days' : 'Last 7 days';
    const best = bars.reduce((a, b) => (b.v > a.v ? b : a), bars[0]);
    const bestDay = month ? `${best.d.getDate()} ${MONTH_NAMES[best.d.getMonth()]}` : DAY_NAMES[best.d.getDay()];
    $('chart-best').textContent = best.v >= 60000 ? `Best: ${bestDay} ${fmtDuration(best.v)}` : '';

    renderMap(totals, now, streakMap);
}

// ---------- Records ----------
// Saved on their own under 'records' (like bestStreak), so pruning the focus log after 365 days never lowers them:
// { day, week, streak, session: { v: value, id: its day / first day, newOn: day it was beaten, to: streak end },
//   since: first day with focus, archived: ms of pruned days, archivedTo: days before this are in 'archived' }
const parseDay = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
};
const shiftDay = (key, n) => {
    const d = parseDay(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
};

// A record only goes up. Beating one set on another day shows NEW until midnight.
function bumpRecord(rec, name, v, id, extra) {
    const prev = rec[name];
    if (v <= 0 || (prev && v <= prev.v)) return;
    const newOn = prev && prev.v > 0 && prev.id !== id ? dayKey() : (prev ? prev.newOn || null : null);
    rec[name] = { v, id, newOn, ...extra };
}

function updateRecords(totals) {
    const saved = store.get('records', {});
    const rec = saved && typeof saved === 'object' ? { ...saved } : {};
    const days = Object.keys(totals).filter((k) => totals[k] > 0).sort();

    let bestDay = null;
    for (const k of days) if (!bestDay || totals[k] > totals[bestDay]) bestDay = k;
    if (bestDay) bumpRecord(rec, 'day', totals[bestDay], bestDay);

    const weeks = {};                                   // Monday -> total
    for (const k of days) {
        const w = shiftDay(k, -((parseDay(k).getDay() + 6) % 7));
        weeks[w] = (weeks[w] || 0) + totals[k];
    }
    let bestWeek = null;
    for (const w of Object.keys(weeks)) if (!bestWeek || weeks[w] > weeks[bestWeek]) bestWeek = w;
    if (bestWeek) bumpRecord(rec, 'week', weeks[bestWeek], bestWeek);

    let best = null;                                    // longest run of 1h+ days
    let run = null;
    for (const k of days) {
        if (totals[k] < HOUR_MS) continue;
        run = run && shiftDay(run.to, 1) === k ? { ...run, v: run.v + 1, to: k } : { v: 1, id: k, to: k };
        if (!best || run.v > best.v) best = run;
    }
    if (best) bumpRecord(rec, 'streak', best.v, best.id, { to: best.to });

    let bestSession = null;
    for (const [k, v] of Object.entries(focusLongest)) if (!bestSession || v > focusLongest[bestSession]) bestSession = k;
    if (bestSession) bumpRecord(rec, 'session', focusLongest[bestSession], bestSession);

    if (days.length && (!rec.since || days[0] < rec.since)) rec.since = days[0];
    if (JSON.stringify(rec) !== JSON.stringify(saved)) store.set('records', rec);
    return rec;
}

// Called before old days are pruned: their records stay, and their time is added to the all-time total once
function archiveOldFocus(cutoff) {
    const totals = totalsByDay();
    const rec = updateRecords(totals);
    if (rec.archivedTo && rec.archivedTo >= cutoff) return;
    let add = 0;
    for (const [k, ms] of Object.entries(totals)) if (k < cutoff && k >= (rec.archivedTo || '')) add += ms;
    rec.archived = (rec.archived || 0) + add;
    rec.archivedTo = cutoff;
    store.set('records', rec);
}

// Desktop text and the shorter phone text (shown under 700px)
function recText(id, long, short = long) {
    const el = $(id);
    if (long === short) el.textContent = long;
    else el.replaceChildren(makeEl('span', 'rec-long', long), makeEl('span', 'rec-short', short));
}

function recValue(id, value, longUnit, shortUnit) {
    const el = $(id);
    el.replaceChildren(document.createTextNode(value));
    if (longUnit) el.append(makeEl('span', 'stat-unit' + (shortUnit !== undefined ? ' rec-long' : ''), longUnit));
    if (shortUnit) el.append(makeEl('span', 'stat-unit rec-short', shortUnit));
}

function renderRecords(totals) {
    const rec = updateRecords(totals);
    const todayKey = dayKey();
    const thisYear = new Date().getFullYear();
    const dateLabel = (key, withYear) => {
        const d = parseDay(key);
        return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` + (withYear || d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : '');
    };
    const onDay = (id, key) => (key === todayKey ? recText(id, `Today, ${dateLabel(key)}`, 'Today') : recText(id, dateLabel(key)));
    const isNew = (r) => !!r && r.newOn === todayKey;

    // Best day
    $('rec-day').classList.toggle('new', isNew(rec.day));
    $('rec-day-v').textContent = fmtDuration(rec.day ? rec.day.v : 0);
    if (rec.day) onDay('rec-day-sub', rec.day.id); else recText('rec-day-sub', 'No focus yet');

    // Best week
    $('rec-week').classList.toggle('new', isNew(rec.week));
    $('rec-week-v').textContent = fmtDuration(rec.week ? rec.week.v : 0);
    if (rec.week) {
        const a = parseDay(rec.week.id);
        const b = parseDay(shiftDay(rec.week.id, 6));
        recText('rec-week-sub', a.getMonth() === b.getMonth()
            ? `${a.getDate()} – ${dateLabel(dayKey(b))}`
            : `${a.getDate()} ${MONTH_NAMES[a.getMonth()]} – ${dateLabel(dayKey(b))}`);
    } else recText('rec-week-sub', 'No focus yet');

    // Longest streak (bestStreak may know a longer one from before the log was pruned)
    const streak = Math.max(rec.streak ? rec.streak.v : 0, store.get('bestStreak', 0));
    const known = rec.streak && rec.streak.v === streak;
    $('rec-streak').classList.toggle('new', known && isNew(rec.streak));
    recValue('rec-streak-v', String(streak), streak === 1 ? ' day' : ' days', ' d');
    if (known) {
        const a = parseDay(rec.streak.id);
        const b = parseDay(rec.streak.to);
        const md = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
        if (rec.streak.id === rec.streak.to) recText('rec-streak-sub', md(a));
        else if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) recText('rec-streak-sub', `${md(a)} – ${md(b)}`, `${md(a)} – ${b.getDate()}`);
        else recText('rec-streak-sub', `${md(a)} – ${md(b)}`);
    } else recText('rec-streak-sub', streak ? '' : 'Focus 1h a day');

    // Longest session: dashed until the first one is saved
    $('rec-session').classList.toggle('new', isNew(rec.session));
    $('rec-session').classList.toggle('empty', !rec.session);
    $('rec-session-v').textContent = rec.session ? fmtDuration(rec.session.v) : '—';
    if (rec.session) onDay('rec-session-sub', rec.session.id);
    else recText('rec-session-sub', 'Starts counting from now', 'from now');

    // Average per active day and days with focus, over the last 365 days
    const cutoff = dayKey(dateAgo(364));
    let active = 0;
    let sum = 0;
    for (const [k, ms] of Object.entries(totals)) if (k >= cutoff && ms > 0) { active++; sum += ms; }
    $('rec-avg-v').textContent = fmtDuration(active ? sum / active : 0);
    recText('rec-avg-sub', `${active} active ${active === 1 ? 'day' : 'days'}`, `${active} ${active === 1 ? 'day' : 'days'}`);
    recValue('rec-days-v', String(active), ' / 365', '');
    recText('rec-days-sub', `${Math.round((active / 365) * 100)}% of the last year`, 'of 365');

    // All time: the log plus the days already pruned from it
    let total = rec.archived || 0;
    for (const ms of Object.values(totals)) total += ms;
    $('rec-all-v').textContent = total >= HOUR_MS ? `${Math.floor(total / HOUR_MS)}h` : fmtDuration(total);
    recText('rec-all-sub', rec.since ? `Since ${dateLabel(rec.since, true)}` : 'No focus yet');
}

// ---- Focus map: one square per day, 52 weeks + this week, Monday first ----
const mapGrid = $('map-grid');
const mapWrap = $('map-wrap');
const mapTip = $('map-tip');

function renderMap(totals, now, streakMap) {
    const offset = (now.getDay() + 6) % 7;      // days since Monday
    const count = 364 + offset + 1;
    if (mapGrid.dataset.count !== String(count)) {   // build once, then only update colors
        mapGrid.replaceChildren();
        // month labels: one where a column's Monday starts a new month
        const labels = [];
        let prev = -1;
        for (let c = 0; c < 53; c++) {
            const monday = dateAgo(offset + 364 - c * 7);
            if (monday.getMonth() !== prev) {
                prev = monday.getMonth();
                labels.push({ c, name: MONTH_NAMES[prev] });
            }
        }
        if (labels.length > 1 && labels[1].c - labels[0].c < 3) labels.shift(); // avoid overlap
        labels.forEach(({ c, name }) => {
            const s = makeEl('span', 'map-month', name);
            s.style.gridColumn = String(c + 2);
            mapGrid.append(s);
        });
        [['Mon', 2], ['Wed', 4], ['Fri', 6]].forEach(([name, row]) => {
            const s = makeEl('span', 'map-dow', name);
            s.style.gridRow = String(row);
            mapGrid.append(s);
        });
        for (let i = 0; i < count; i++) {
            const cell = makeEl('i', 'map-cell l0');
            cell.style.gridColumn = String(Math.floor(i / 7) + 2);
            cell.style.gridRow = String((i % 7) + 2);
            mapGrid.append(cell);
        }
        mapGrid.dataset.count = String(count);
    }
    let total = 0;
    mapGrid.querySelectorAll('.map-cell').forEach((cell, i) => {
        const d = dateAgo(offset + 364 - i);
        const ms = totals[dayKey(d)] || 0;
        total += ms;
        const streakDay = streakMap[dayKey(d)];
        cell.className = `map-cell l${Math.min(4, Math.floor(ms / 3600000))}` + (streakDay ? ' s' : '');
        cell.dataset.ms = ms;
        cell.dataset.streak = streakDay || '';
        cell.dataset.label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
            + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '');
    });
    $('map-total').textContent =
        `${total >= 3600000 ? Math.floor(total / 3600000) + 'h' : fmtDuration(total)} in the last 12 months`;
}

function showTip(cell) {
    const ms = Number(cell.dataset.ms);
    mapTip.textContent = `${cell.dataset.label} · ${ms ? fmtDuration(ms) : 'No focus'}`
        + (cell.dataset.streak ? ` · streak day ${cell.dataset.streak}` : '');
    mapTip.hidden = false;
    const box = mapTip.parentElement.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const tw = mapTip.offsetWidth;
    const th = mapTip.offsetHeight;
    const center = c.left - box.left + c.width / 2;
    const left = Math.max(0, Math.min(box.width - tw, center - tw / 2));
    mapTip.style.left = `${left}px`;
    mapTip.style.top = `${c.top - box.top - th - 8}px`;
    mapTip.style.setProperty('--arrow', `${Math.max(8, Math.min(tw - 8, center - left))}px`);
}

mapGrid.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.map-cell');
    if (cell) showTip(cell);
});
mapGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.map-cell');
    if (cell) showTip(cell);
});
mapGrid.addEventListener('mouseleave', () => { mapTip.hidden = true; });
mapWrap.addEventListener('scroll', () => { mapTip.hidden = true; });
document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.map-cell')) mapTip.hidden = true;
});

rangeBtns.forEach((b) => b.addEventListener('click', () => {
    statsRange = b.dataset.range;
    rangeBtns.forEach((x) => x.classList.toggle('active', x === b));
    renderStats();
}));

// "Start a session": to the Focus tab, where Start begins the first one
$('stats-start').addEventListener('click', () => showTab('focus'));
