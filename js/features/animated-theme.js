// Clockus — the Animated theme: the chosen video behind the whole site, under a dark layer
// Loaded as a classic script (shared global scope). Load order is set in app.html (right after aesthetic-mode.js).
//
// The theme is ui.theme = 'animated' (synced like any theme). The video is the same choice as Aesthetic mode,
// aesthetic.scene (device-only key `aesthetic`), so picking one here also changes Aesthetic mode, and back.
// The page uses the colours of Dark (the dark layer keeps text readable); the accent works as usual.
// With Animations off, or when the device asks to save data, it shows a still frame. The video pauses when the
// tab is hidden and while Aesthetic mode (which has its own copy on top) is open.

const themeBg = $('theme-bg');
const themeBgScene = $('theme-bg-scene');
const themeBgVideo = $('theme-bg-video');
const prevAnimated = $('prev-animated');
const animRows = document.querySelectorAll('.set-anim');   // Animated background and Christmas Specials
const animTiles = document.querySelectorAll('[data-anim-scene]');
// A background whose video is not on the site yet (a Christmas Special not in AES_XMAS_READY) cannot be picked
animTiles.forEach((b) => {
    const k = b.dataset.animScene;
    b.disabled = !AES_SCENES.includes(k);
    if (!b.disabled) aesPicture(b.querySelector('.set-prev'), k);
});
const animSaveData = !!(navigator.connection && navigator.connection.saveData);

// The background never holds up the page: the clock is drawn at once, and the background stays invisible until its
// picture has loaded, then fades in (0.4 s; at once with Animations off, see app.css). The video follows on top of it.
let themeBgShown = false;
let themeBgWaiting = false;
themeBgScene.classList.add('loading');
function revealThemeBg(scene) {
    if (themeBgShown || themeBgWaiting) return;
    themeBgWaiting = true;
    const img = new Image();
    img.onload = img.onerror = () => {
        themeBgShown = true;
        themeBgScene.classList.remove('loading');
    };
    img.src = scene.poster;
}

function syncThemeBg() {
    const on = ui.theme === 'animated';
    const scene = AES_VIDEOS[aesthetic.scene];
    if (on) revealThemeBg(scene);

    // Aesthetic mode belongs to the Animated theme: its button on Focus shows only then. Leaving the theme while
    // in Aesthetic mode (from another device, say) goes back to Clean mode.
    aesPill.hidden = !on;
    if (!on && aesOpen) {
        setAesthetic(false);   // calls this again, with aesOpen now false
        setClean(true);
        return;
    }
    themeBg.hidden = !on;
    themeBgScene.dataset.scene = aesthetic.scene;
    aesPicture(themeBgScene, aesthetic.scene);   // still picture of a Christmas background (aesthetic-mode.js)

    const moving = on && ui.animations && !animSaveData;
    const play = moving && !document.hidden && !aesOpen;
    if (play && themeBgVideo.getAttribute('src') !== scene.src) {
        themeBgVideo.poster = scene.poster;
        themeBgVideo.src = scene.src;
    }
    themeBgVideo.hidden = !moving;   // a still frame: the picture behind it (CSS)
    if (play && themeBgVideo.paused) {
        themeBgVideo.muted = true;
        const p = themeBgVideo.play();
        if (p && p.catch) p.catch(() => {});
    } else if (!play && !themeBgVideo.paused) {
        themeBgVideo.pause();
    }

    // Settings › Appearance: the Animated card shows the chosen background; the row is dimmed with another theme
    prevAnimated.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.42)), url("${scene.poster}")`;
    animRows.forEach((r) => r.classList.toggle('off', !on));
    press(animTiles, (b) => b.dataset.animScene === aesthetic.scene);
}

// One tap picks the background and, if another theme is on, switches to Animated
animTiles.forEach((b) => b.addEventListener('click', () => {
    if (aesthetic.scene !== b.dataset.animScene) changeAesthetic('scene', b.dataset.animScene);   // aesthetic-mode.js
    if (ui.theme !== 'animated') document.querySelector('[data-theme-choice="animated"]').click();   // same path as the card
    syncThemeBg();
}));

document.addEventListener('visibilitychange', syncThemeBg);
syncThemeBg();
