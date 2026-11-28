// Clockus — service worker: the app opens without a connection.
// Registered by js/pwa.js with scope /app, so it controls only the app page (not the landing pages).
//
// After a deploy that changes cached files without changing their address (icons, sounds, the manifest),
// raise CACHE_VERSION. Pages and the versioned CSS/JS (?v=) are refreshed anyway:
// - the app page is fetched from the network first; the cached copy is only for offline,
// - CSS and JS carry ?v= in their address, so a new version is a new file in the cache.
// Requests to Supabase and to the Google sign-in never go through the cache.

const CACHE_VERSION = 'v3';
const CACHE = `clockus-${CACHE_VERSION}`;            // the app shell, filled at install
const RUNTIME = `clockus-runtime-${CACHE_VERSION}`;  // fonts, the Supabase library, files met later
const APP_PAGE = '/app';

const STATIC_FILES = [
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    '/apple-touch-icon.png',
    '/favicon.svg',
    '/favicon.ico'
];
// Ambient sounds (js/features/ambient-sound.js): sounds/<background>.mp3. Missing files are skipped.
const SOUND_SCENES = ['samurai', 'rainy-garden', 'cherry-grove', 'autumn', 'winter', 'lofi-coffee', 'christmas',
    'minecraft-fireplace', 'adventure-time', 'forest-snowfall', 'winter-evening', 'northern-landscape'];

// Never cached: the database, sign-in and anything that is not a plain GET
const NEVER = [/\.supabase\.co$/, /(^|\.)accounts\.google\.com$/, /(^|\.)googleapis\.com$/i];
const isNever = (url) => NEVER.some((re) => re.test(url.hostname)) && !/^fonts\.googleapis\.com$/.test(url.hostname);
const isRuntimeHost = (url) => /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);

// ---------- Install: the page, every CSS/JS file it loads, icons, fonts ----------
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        const res = await fetch(APP_PAGE, { cache: 'reload' });
        if (!res.ok) throw new Error(`App page: HTTP ${res.status}`);
        const html = await res.clone().text();
        await cache.put(APP_PAGE, res);

        // The files the page loads, read from the page itself, so this list never goes out of date
        const local = new Set(STATIC_FILES);
        const external = new Set();
        for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
            const url = new URL(m[1], self.location.origin + APP_PAGE);
            if (url.origin === self.location.origin) {
                if (/\.(css|js)$/.test(url.pathname)) local.add(url.pathname + url.search);
            } else if (isRuntimeHost(url)) {
                external.add(url.href);
            }
        }
        await cache.addAll([...local]);
        await cacheExternal([...external]);
        await self.skipWaiting();   // take over at once: nobody stays on the old version
    })());
});

// Google Fonts stylesheets, the font files they list (Latin only), and the Supabase library
async function cacheExternal(urls) {
    const cache = await caches.open(RUNTIME);
    await Promise.allSettled(urls.map(async (href) => {
        const url = new URL(href);
        if (url.hostname === 'fonts.googleapis.com') {
            const res = await fetch(href, { mode: 'cors' });
            if (!res.ok) return;
            const css = await res.clone().text();
            await cache.put(href, res);
            const fonts = [];
            // Each block starts with a comment naming its script: keep latin and latin-ext
            for (const block of css.split('/*').slice(1)) {
                if (!/^\s*latin(-ext)?\s*\*\//.test(block)) continue;
                const src = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
                if (src) fonts.push(src[1]);
            }
            await Promise.allSettled(fonts.map((f) => fetch(f, { mode: 'cors' }).then((r) => r.ok && cache.put(f, r))));
        } else {
            const res = await fetch(href, { mode: 'no-cors' });
            await cache.put(href, res);
        }
    }));
}

// ---------- Activate: remove old versions, control open pages, then fetch the sounds ----------
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = new Set([CACHE, RUNTIME]);
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n.startsWith('clockus-') && !keep.has(n)).map((n) => caches.delete(n)));
        await self.clients.claim();
    })());
});

// Sounds are large: the page asks for them once the app is running (js/pwa.js), so they never hold it up.
// Waiting for them during "activate" would hold every request until they are downloaded.
self.addEventListener('message', (event) => {
    if (event.data === 'cache-sounds') event.waitUntil(cacheSounds());
});

async function cacheSounds() {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SOUND_SCENES.map(async (s) => {
        const path = `/sounds/${s}.mp3`;
        if (await cache.match(path)) return;
        const res = await fetch(path);
        if (res.ok && res.status === 200) await cache.put(path, res);
    }));
}

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
    if (isNever(url)) return;   // Supabase, Google sign-in: straight to the network

    if (req.mode === 'navigate') {
        if (url.origin === self.location.origin) event.respondWith(appPage(req));
        return;
    }
    if (url.origin === self.location.origin) {
        if (url.pathname.startsWith('/sounds/')) { event.respondWith(sound(req, url)); return; }
        if (/\.mp4$/.test(url.pathname)) return;   // background videos: streamed, not cached
        event.respondWith(cacheFirst(req));
        return;
    }
    if (isRuntimeHost(url)) event.respondWith(staleWhileRevalidate(req));
});

// The app page: newest from the network; the cached copy when offline
async function appPage(req) {
    try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(APP_PAGE, res.clone());
        return res;
    } catch (err) {
        const cached = await caches.match(APP_PAGE);
        if (cached) return cached;
        throw err;
    }
}

async function cacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.status === 200) (await caches.open(RUNTIME)).put(req, res.clone());
    return res;
}

async function staleWhileRevalidate(req) {
    const cache = await caches.open(RUNTIME);
    const cached = await cache.match(req);
    const fresh = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
    }).catch(() => cached);
    return cached || fresh;
}

// Audio asks for byte ranges; a cached sound answers with the part it asked for
async function sound(req, url) {
    let full = await caches.match(url.pathname);
    if (!full) {
        const res = await fetch(url.pathname);
        if (!res.ok || res.status !== 200) return res;
        (await caches.open(CACHE)).put(url.pathname, res.clone());
        full = res;
    }
    const range = req.headers.get('range');
    if (!range) return full;
    const buf = await full.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const size = buf.byteLength;
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }   // "bytes=-500"
    if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
            'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes'
        }
    });
}
