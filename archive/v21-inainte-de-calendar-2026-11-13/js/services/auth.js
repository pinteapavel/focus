// Clockus — account: Google sign-in, sign-out, auth state
// Loaded as a classic script (shared global scope). Load order is set in app.html.

function updateAccountUi() {
    accountOut.hidden = !!user;
    accountIn.hidden = !user;
    accountEmail.textContent = user ? (user.email || 'Signed in') : '';
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
    await sb.auth.signOut();
    // Clear this device's copy so the next person who signs in doesn't inherit it
    tasks = [];
    renderTasks();
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
