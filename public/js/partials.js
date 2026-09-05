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
    document.dispatchEvent(new Event('chrome:ready'));
}
