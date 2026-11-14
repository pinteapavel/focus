// Clockus — account: Google sign-in, sign-out, auth state
// Loaded as a classic script (shared global scope). Load order is set in app.html.

function updateAccountUi() {
    accountOut.hidden = !!user;
    accountIn.hidden = !user;
    // The round badge shows the first letter; the full address is its label
    const email = user ? (user.email || 'Signed in') : '';
    accountEmail.textContent = email ? email[0].toUpperCase() : '';
    accountEmail.title = email;
    accountEmail.setAttribute('aria-label', email ? `Signed in as ${email}` : '');
    accountNote.textContent = user
        ? 'Signed in. Your timer, tasks and focus time sync across devices.'
        : 'Sign in to keep your timer, tasks and focus time synced across devices.';
    if (!user) setSync('Not signed in');
    if (typeof renderSettingsSummary === 'function') renderSettingsSummary();
    if (typeof renderAccountMenu === 'function') renderAccountMenu();
}

googleBtn.addEventListener('click', async () => {
    if (!sb) {
        accountNote.textContent = 'Could not load the sign-in service. Check your connection.';
        return;
    }
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) accountNote.textContent = 'Could not start sign-in. Please try again.';
});

signoutBtn.addEventListener('click', async () => {
    if (!sb) return;
    await flushSettings();   // send the last changes first, so nothing is lost
    await sb.auth.signOut();
    // Clear this device's copy of the account so the next person who signs in doesn't inherit it
    // (and it doesn't get merged into their account)
    tasks = [];
    dirtyUp.clear();
    dirtyDel.clear();
    saveDirty();
    for (const dev of Object.keys(focusLog)) delete focusLog[dev];
    store.set('focus', focusLog);
    sessions = [];
    saveSessions();
    goals = null;
    store.set('goals', null);
    store.set('goalsOffAt', 0);
    renderTasks();
    refreshGoals();
    updateStats();
});

// ---------- Top bar: the account avatar and its small menu ----------
// Sign in / out reuse the buttons in Settings › Account and data, so the logic lives in one place.
const avatarBtn = $('avatar-btn');
const accountMenu = $('account-menu');

function renderAccountMenu() {
    const email = user ? (user.email || '') : '';
    $('avatar-initial').textContent = email ? email[0].toUpperCase() : '';
    avatarBtn.classList.toggle('signed', !!user);
    avatarBtn.title = user ? `Account: ${email}` : 'Account: not signed in';
    avatarBtn.setAttribute('aria-label', avatarBtn.title);
    $('am-who').textContent = user ? email : 'Not signed in';
    $('am-note').textContent = accountNote.textContent;
    $('am-sync').hidden = !user;
    $('am-status').textContent = syncStatus.textContent;
    $('am-pill').dataset.state = syncStatus.parentElement.dataset.state || 'off';
    $('am-when').textContent = $('sync-when').textContent;
    $('am-signin').hidden = !!user;
    $('am-signout').hidden = !user;
}

function setAccountMenu(open) {
    if (open) renderAccountMenu();
    accountMenu.hidden = !open;
    avatarBtn.setAttribute('aria-expanded', String(open));
    if (open) (user ? $('am-signout') : $('am-signin')).focus();
}

avatarBtn.addEventListener('click', () => setAccountMenu(accountMenu.hidden));
$('am-signin').addEventListener('click', () => googleBtn.click());
$('am-signout').addEventListener('click', () => { setAccountMenu(false); signoutBtn.click(); });
document.addEventListener('pointerdown', (e) => {
    if (!accountMenu.hidden && !e.target.closest('.topbar-right')) setAccountMenu(false);
});
accountMenu.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();   // close only the menu, not clean mode or anything else
    setAccountMenu(false);
    avatarBtn.focus();
});

if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
        const next = session ? session.user : null;
        const changed = (next && next.id) !== (user && user.id);
        user = next;
        updateAccountUi();
        if (user && changed) setTimeout(loadCloud, 0);
    });
}

// Refresh from the cloud when coming back to the tab (e.g. after using another device)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && user) loadCloud();
});

updateAccountUi();
