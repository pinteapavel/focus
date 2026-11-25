// Clockus — the "Send feedback" box. One file for the landing page, the 404 page and the app (Settings › Help).
// Any element with data-feedback opens it; data-feedback="bug" (or "idea", "other") picks the type first.
//
// Messages are added to the Supabase table `feedback` (docs/sql/feedback.sql). The page can only add a message,
// never read one. In the app the signed in person's client is used (so their id can be attached); elsewhere a
// plain request with the public key. No service key is used anywhere.
(function () {
    const FB_URL = 'https://bdlrjmcrmlaqwuzynvtz.supabase.co';
    const FB_KEY = 'sb_publishable_vWR5en-EDQdOO66ZbOzklQ_E1PdcAKI';   // the same public key as js/services/sync.js
    const FB_MAIL = '';   // contact address for the "write to us instead" link when sending fails; empty = no link
    const MAX = 1000;
    const TYPES = [['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']];

    const appClient = () => (typeof sb !== 'undefined' && sb ? sb : null);
    const appUser = () => (typeof user !== 'undefined' && user ? user : null);

    let modal = null;
    let els = {};
    let type = 'idea';
    let sending = false;
    let lastSent = '';     // the message just sent: the same text is not sent twice
    let returnFocus = null;

    function el(tag, attrs, text) {
        const e = document.createElement(tag);
        for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
        if (text) e.textContent = text;
        return e;
    }

    function build() {
        modal = el('div', { class: 'fb-modal', hidden: '' });
        const card = el('div', { class: 'fb-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fb-title' });

        const form = el('div', { class: 'fb-form' });
        form.append(el('h2', { class: 'fb-title', id: 'fb-title' }, 'Send feedback'));
        const types = el('div', { class: 'fb-types', role: 'radiogroup', 'aria-label': 'Type of feedback' });
        TYPES.forEach(([v, label]) => types.append(el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-type': v }, label)));
        form.append(types);
        form.append(el('label', { class: 'fb-sr', for: 'fb-message' }, 'Message'));
        const msg = el('textarea', { id: 'fb-message', class: 'fb-field', rows: '5', maxlength: String(MAX), placeholder: 'What happened, or what would help?' });
        form.append(msg);
        const count = el('div', { class: 'fb-count', 'aria-hidden': 'true' }, `0 / ${MAX}`);
        form.append(count);
        form.append(el('label', { class: 'fb-sr', for: 'fb-email' }, 'Your email (optional)'));
        const email = el('input', { id: 'fb-email', class: 'fb-field', type: 'email', maxlength: '254', autocomplete: 'email', placeholder: 'you@example.com', 'aria-describedby': 'fb-hint' });
        form.append(email);
        form.append(el('p', { class: 'fb-hint', id: 'fb-hint' }, 'Optional. Only used to reply to you.'));
        const error = el('p', { class: 'fb-error', role: 'alert', hidden: '' });
        form.append(error);
        const actions = el('div', { class: 'fb-actions' });
        const cancel = el('button', { type: 'button', class: 'fb-btn' }, 'Cancel');
        const send = el('button', { type: 'button', class: 'fb-btn primary', disabled: '' }, 'Send');
        actions.append(cancel, send);
        form.append(actions);

        const done = el('div', { class: 'fb-done', hidden: '' });
        done.append(el('span', { class: 'fb-check', 'aria-hidden': 'true' }, '✓'));
        done.append(el('h2', { class: 'fb-title', id: 'fb-done-title' }, 'Thank you'));
        done.append(el('p', { class: 'fb-done-text' }, 'Your message was sent. If you left an email, you will get a reply there.'));
        const close = el('button', { type: 'button', class: 'fb-btn' }, 'Close');
        done.append(close);

        card.append(form, done);
        modal.append(card);
        document.body.append(modal);
        els = { card, form, types, msg, count, email, error, cancel, send, done, close };

        types.addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) setType(b.dataset.type); });
        types.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const i = TYPES.findIndex(([v]) => v === type);
            const next = TYPES[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? TYPES.length - 1 : 1)) % TYPES.length][0];
            setType(next);
            types.querySelector(`[data-type="${next}"]`).focus();
        });
        msg.addEventListener('input', () => { count.textContent = `${msg.value.length} / ${MAX}`; error.hidden = true; refresh(); });
        email.addEventListener('input', () => { error.hidden = true; });
        cancel.addEventListener('click', closeBox);
        close.addEventListener('click', closeBox);
        send.addEventListener('click', submit);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeBox(); });
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeBox(); }
            else if (e.key === 'Tab') {
                const items = [...card.querySelectorAll('button, textarea, input')].filter((x) => !x.disabled && x.offsetParent !== null);
                const i = items.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
                else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
            }
            e.stopPropagation();   // no app shortcuts while the box is open
        });
    }

    function setType(v) {
        type = v;
        els.types.querySelectorAll('[data-type]').forEach((b) => {
            const on = b.dataset.type === v;
            b.classList.toggle('on', on);
            b.setAttribute('aria-checked', String(on));
            b.tabIndex = on ? 0 : -1;
        });
    }

    function refresh() {
        const text = els.msg.value.trim();
        els.send.disabled = sending || !text || text === lastSent;
    }

    function openBox(preset) {
        if (!modal) build();
        returnFocus = document.activeElement;
        setType(TYPES.some(([v]) => v === preset) ? preset : type);
        const u = appUser();
        if (u && u.email && !els.email.value) els.email.value = u.email;   // signed in: filled in, can be changed
        els.error.hidden = true;
        els.form.hidden = false;
        els.done.hidden = true;
        els.card.setAttribute('aria-labelledby', 'fb-title');
        refresh();
        modal.hidden = false;
        document.body.classList.add('fb-lock');
        els.msg.focus();
    }

    function closeBox() {
        if (!modal || sending) return;
        modal.hidden = true;
        document.body.classList.remove('fb-lock');
        if (!els.done.hidden) { els.msg.value = ''; els.count.textContent = `0 / ${MAX}`; }
        if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    }

    function showError(text) {
        els.error.textContent = text + ' ';
        if (FB_MAIL) {
            const a = el('a', { href: `mailto:${FB_MAIL}?subject=${encodeURIComponent('Clockus feedback')}&body=${encodeURIComponent(els.msg.value)}` }, 'Send it by email instead');
            els.error.append(a);
        }
        els.error.hidden = false;
    }

    async function insert(row) {
        const client = appClient();
        if (client) {
            const { error } = await client.from('feedback').insert(row);   // no .select(): the page may not read
            if (error) throw error;
            return;
        }
        const res = await fetch(`${FB_URL}/rest/v1/feedback`, {
            method: 'POST',
            headers: { apikey: FB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(row)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }

    async function submit() {
        const message = els.msg.value.trim().slice(0, MAX);
        const email = els.email.value.trim();
        if (sending || !message || message === lastSent) return;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showError('That email does not look right. Fix it or leave it empty.');
            els.email.focus();
            return;
        }
        sending = true;
        refresh();
        els.send.textContent = 'Sending…';
        els.cancel.disabled = true;
        const u = appUser();
        const row = { type, message, email: email || null, page: location.pathname.slice(0, 200) };
        if (u && appClient()) row.user_id = u.id;
        try {
            await insert(row);
            lastSent = message;
            els.form.hidden = true;
            els.done.hidden = false;
            els.card.setAttribute('aria-labelledby', 'fb-done-title');
            els.close.focus();
        } catch (err) {
            console.warn('Feedback was not sent:', err);
            showError('Something went wrong, your message was not sent. Try again.');
        } finally {
            sending = false;
            els.send.textContent = 'Send';
            els.cancel.disabled = false;
            refresh();
        }
    }

    document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-feedback]');
        if (!t) return;
        e.preventDefault();
        openBox(t.dataset.feedback);
    });
})();
