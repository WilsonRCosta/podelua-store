// Fetches a partial and injects it into the DOM at the given placeholder.
// Returns a promise so callers can wait until the markup exists before
// wiring up event listeners on elements inside it (e.g. #openCart).
async function loadPartial(url, mountSelector) {
    const mount = document.querySelector(mountSelector);
    if (!mount) return;
    const res = await fetch(url);
    mount.outerHTML = await res.text();
}

async function loadSiteChrome() {
    await Promise.all([
        loadPartial('/partials/header.html', '#header-mount'),
        loadPartial('/partials/cart-drawer.html', '#cart-drawer-mount'),
    ]);
    initNavToggle();
    document.dispatchEvent(new Event('chrome:ready'));
}

// Mobile menu: must be wired after the header partial replaces the placeholder
function initNavToggle() {
    const toggle = document.getElementById('navToggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) nav.classList.remove('open');
    });
}
