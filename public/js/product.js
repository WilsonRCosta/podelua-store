(function () {
    'use strict';

    const productId = new URLSearchParams(window.location.search).get('id');
    const loadingEl = document.getElementById('detailLoading');
    const detailEl = document.getElementById('productDetail');
    let savedCustomValues = null; // set once the shopper saves the customization panel

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
            products = await getProducts();
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
        document.getElementById('detailLongDesc').innerHTML =
            (product.longDescription || product.description).replace(/\n/g, '<br>');

        document.getElementById('detailCarouselMount').innerHTML = renderCarousel(product, 'large');

        const carouselEl = document.querySelector(`.carousel[data-carousel-id="${product.id}"]`);
        if (carouselEl)
            enableCarouselSwipe(carouselEl, product.id);
        document.getElementById('detailSwatchesMount').innerHTML = renderColorSwatches(product);
        const addBtn = document.getElementById('detailAddBtn');
        const hasCustomFields = product.customFields?.length > 0;
        if (hasCustomFields) {
            // Stays disabled until the customization is saved in the panel
            addBtn.disabled = true;
            initCustomDrawer(product);
        }

        addBtn.addEventListener('click', () => {
            if (hasCustomFields && !savedCustomValues) return;
            addToCart(product.id, getSelectedColor(product), true, savedCustomValues || []);
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

    // Side panel holding the customization form; slides in from the right
    // like the cart drawer and shares its overlay.
    function initCustomDrawer(product) {
        const formEl = document.getElementById('detailCustomFieldsMount');
        formEl.innerHTML = renderCustomFieldsForm(product);

        // Live character counter for text-type fields
        formEl.querySelectorAll('input[maxlength]').forEach((input) => {
            const counter = input.parentElement.querySelector('.char-count');
            input.addEventListener('input', () => {
                counter.textContent = `${input.value.length}/${input.maxLength}`;
            });
        });

        const triggerEl = document.getElementById('detailCustomizeBtn');
        const summaryEl = document.getElementById('detailCustomSummary');
        triggerEl.style.display = '';
        triggerEl.addEventListener('click', openCustomDrawer);

        const save = () => {
            const customValues = collectCustomFieldValues(product);
            if (customValues === null) return;
            savedCustomValues = customValues;
            summaryEl.textContent = customValues.map((cv) => cv.value).join(' · ');
            triggerEl.classList.add('is-done');
            document.getElementById('detailAddBtn').disabled = false;
            closeCustomDrawer();
        };

        document.getElementById('customConfirmBtn').addEventListener('click', save);
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            save();
        });
        document.getElementById('closeCustom').addEventListener('click', closeCustomDrawer);
        document.getElementById('overlay').addEventListener('click', closeCustomDrawer);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCustomDrawer();
        });
    }

    function openCustomDrawer() {
        document.getElementById('customDrawer').classList.add('open');
        document.getElementById('overlay').classList.add('open');
        document.querySelector('#detailCustomFieldsMount input')?.focus({ preventScroll: true });
    }

    function closeCustomDrawer() {
        const drawerEl = document.getElementById('customDrawer');
        if (!drawerEl.classList.contains('open')) return;
        drawerEl.classList.remove('open');
        document.getElementById('overlay').classList.remove('open');
    }
})();