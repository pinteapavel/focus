// Clockus — Settings › Account and data › Danger zone: delete the account and everything saved online
// Loaded as a classic script (shared global scope), after sync.js and auth.js. Load order is set in app.html.
//
// The page only calls the Supabase function delete_my_account() with the signed in person's own session.
// The function (docs/sql/delete-account.sql) takes the id from that session, never from the page, and removes
// the rows in `tasks` and `user_settings` and then the login itself, all in one transaction.
// Data saved in this browser is not touched: the dialog says so.

const deleteIn = $('delete-in');
const deleteOut = $('delete-out');
const deleteBtn = $('delete-btn');
const delModal = $('del-modal');
const delInput = $('del-input');
const delConfirm = $('del-confirm');
const delCancel = $('del-cancel');
const delError = $('del-error');
let delBusy = false;
let delReturn = null;

// Signed in: "Delete account…". Signed out: nothing synced exists, so only a line about signing in.
function renderDangerZone() {
    deleteIn.hidden = !user;
    deleteOut.hidden = !!user;
    if (!user && !delModal.hidden && !delBusy) closeDeleteDialog();
}

const delReady = () => delInput.value.trim() === 'DELETE';

function openDeleteDialog() {
    if (!user) return;
    delReturn = document.activeElement;
    delInput.value = '';
    delError.hidden = true;
    delConfirm.disabled = true;
    delConfirm.textContent = 'Delete forever';
    delModal.hidden = false;
    document.body.classList.add('modal-open');
    delInput.focus();
}

function closeDeleteDialog() {
    if (delBusy) return;   // never close while deleting: the person must see how it ended
    delModal.hidden = true;
    document.body.classList.remove('modal-open');
    if (delReturn && delReturn.isConnected) delReturn.focus();
}

async function deleteAccount() {
    if (delBusy || !delReady() || !sb || !user) return;
    delBusy = true;
    delError.hidden = true;
    delConfirm.disabled = true;
    delCancel.disabled = true;
    delInput.disabled = true;
    delConfirm.textContent = 'Deleting…';

    // Stop syncing while it runs, so nothing is written back to the account being deleted
    const me = user;
    clearTimeout(pushTimer);
    user = null;

    let ok = false;
    try {
        const { error } = await sb.rpc('delete_my_account');
        if (error) throw error;
        ok = true;
    } catch (err) {
        console.warn('Delete account failed:', err);
    }

    if (!ok) {
        // Nothing was deleted (the function runs in one transaction): back to how it was
        user = me;
        delBusy = false;
        delCancel.disabled = false;
        delInput.disabled = false;
        delConfirm.disabled = !delReady();
        delConfirm.textContent = 'Delete forever';
        delError.hidden = false;
        delInput.focus();
        return;
    }

    // The account is gone. Forget what was waiting to be uploaded to it, end the session on this device,
    // and go to the landing page, which says the account was deleted.
    dirtyUp.clear();
    dirtyDel.clear();
    saveDirty();
    try { await sb.auth.signOut({ scope: 'local' }); } catch {}
    location.replace('./?deleted=1');
}

deleteBtn.addEventListener('click', openDeleteDialog);
delCancel.addEventListener('click', closeDeleteDialog);
delConfirm.addEventListener('click', deleteAccount);
delInput.addEventListener('input', () => {
    delConfirm.disabled = delBusy || !delReady();
    delError.hidden = true;
});
delInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && delReady()) { e.preventDefault(); deleteAccount(); }
});
delModal.addEventListener('click', (e) => { if (e.target === delModal) closeDeleteDialog(); });
delModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeDeleteDialog(); }
    else if (e.key === 'Tab') {
        const items = [delInput, delCancel, delConfirm].filter((el) => !el.disabled);
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    e.stopPropagation();   // no app shortcuts while the dialog is open
});

renderDangerZone();
