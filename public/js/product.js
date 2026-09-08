(function () {
    'use strict';

    const productId = new URLSearchParams(window.location.search).get('id');
    const loadingEl = document.getElementById('detailLoading');
    const detailEl = document.getElementById('productDetail');

    console.log('[product.js] productId from URL:', productId);

    document.addEventListener('DOMContentLoaded', () => {
        console.log('[product.js] DOMContentLoaded, calling loadSiteChrome()');
        loadSiteChrome().catch((err) => {
            console.error('[product.js] loadSiteChrome failed:', err);
            loadingEl.textContent = 'Erro a carregar o cabeçalho. Vê a consola.';
        });
    });

    document.addEventListener('chrome:ready', async () => {
        console.log('[product.js] chrome:ready fired');
        let products;
        try {
            products = await fetchProducts();
            console.log('[product.js] loaded', products.length, 'products');
        } catch (e) {
            console.error('[product.js] failed to fetch products:', e);
            loadingEl.textContent = 'Não foi possível carregar a loja. Vê a consola.';
            return;
        }

        try {
            initCartDrawer(products);
        } catch (e) {
            console.error('[product.js] initCartDrawer failed:', e);
            // don't return — the drawer failing shouldn't block the product itself
        }

        try {
            renderProduct(products);
        } catch (e) {
            console.error('[product.js] renderProduct failed:', e);
            loadingEl.textContent = 'Erro a mostrar esta peça. Vê a consola.';
        }
    });

    function renderProduct(products) {
        if (!productId) {
            loadingEl.textContent = 'Nenhuma peça especificada no URL.';
            return;
        }

        const product = products.find((p) => p.id === productId);
        if (!product) {
            console.warn('[product.js] no product matched id:', productId, 'available ids:', products.map(p => p.id));
            loadingEl.textContent = 'Esta peça já não existe ou foi removida.';
            return;
        }

        document.getElementById('pageTitle').textContent = `${product.name} — Pó de Lua`;
        document.getElementById('detailCategory').textContent =
            product.categories
                .map((category) => CATEGORY_LABELS[category] || category)
                .join(' · ');
        document.getElementById('detailName').textContent = product.name;
        document.getElementById('detailPrice').textContent = formatPrice(product.price);
        document.getElementById('detailShortDesc').textContent = product.description;
        document.getElementById('detailLongDesc').innerHTML =
            (product.longDescription || product.description).replace(/\n/g, '<br>');

        document.getElementById('detailCarouselMount').innerHTML = renderCarousel(product, 'large');
        document.getElementById('detailSwatchesMount').innerHTML = renderColorSwatches(product);

        document.getElementById('detailAddBtn').addEventListener('click', () => {
            const color = getSelectedColor(product);
            addToCart(product.id, color);
        });

        detailEl.addEventListener('click', (e) => {
            const prevBtn = e.target.closest('[data-carousel-prev]');
            const nextBtn = e.target.closest('[data-carousel-next]');
            const dot = e.target.closest('[data-carousel-dot]');
            if (prevBtn) moveCarousel(prevBtn.dataset.carouselPrev, -1);
            if (nextBtn) moveCarousel(nextBtn.dataset.carouselNext, 1);
            if (dot) moveCarousel(dot.dataset.carouselDot, 0, parseInt(dot.dataset.index, 10));
        });

        loadingEl.style.display = 'none';
        detailEl.style.display = 'grid';
    }
})();