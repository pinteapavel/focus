// Clockus — shared helpers: DOM lookup, localStorage wrapper, small utils
// Loaded as a classic script (shared global scope). Load order is set in app.html.

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

const store = {
    get(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, Math.round(Number(n)) || min));
const today = () => new Date().toDateString();
