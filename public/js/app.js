(function () {
  'use strict';

  let PRODUCTS = [];
  let activeCategory = 'all';
  let activeSort = 'created_at:desc';

  const grid = document.getElementById('productGrid');
  const categoryBar = document.getElementById('categoryBar');
  const sortSelect = document.getElementById('sortSelect');
  const yearEl = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- sorting ----------
  function sortProducts(products) {
    const [field, direction] = activeSort.split(':');
    const dir = direction === 'asc' ? 1 : -1;
    const value = (p) => (field === 'price' ? minPrice(p) : new Date(p.createdAt).getTime());
    return [...products].sort((a, b) => (value(a) - value(b)) * dir);
  }

  // ---------- rendering: product grid ----------
  function renderGrid() {
    const items = sortProducts(
        activeCategory === 'all'
            ? PRODUCTS
            : PRODUCTS.filter((p) => p.categories.includes(activeCategory))
    );

    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state">Sem peças nesta categoria por agora.</div>`;
      return;
    }

    grid.innerHTML = items
        .map(
            (p) => `
        <article class="product-card" data-navigate="${p.id}">
          ${renderCarousel(p, 'card')}
          <span class="card-art-hint">Ver peça</span>
          <div class="card-body">
            <span class="card-category">
                ${p.categories
                            .map((category) => CATEGORY_LABELS[category] || category)
                            .join(' · ')}
            </span>
            <h3 class="card-name">${p.name}</h3>
            <p class="card-desc">${p.description}</p>
            ${renderColorSwatches(p)}
            <div class="card-footer">
              <span class="card-price">${formatProductPrice(p)}</span>
              <button class="add-btn" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </article>
      `
        )
        .join('');

    // Wire up swipe on every carousel just rendered
    grid.querySelectorAll('.carousel[data-carousel-id]').forEach((el) => {
      enableCarouselSwipe(el, el.dataset.carouselId);
    });
  }

  // ---------- category filter ----------
  categoryBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    categoryBar.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === btn));
    renderGrid();
  });

  // ---------- sort select ----------
  sortSelect.addEventListener('change', () => {
    activeSort = sortSelect.value;
    renderGrid();
  });

  // ---------- delegated clicks: carousel / add / navigate ----------
  grid.addEventListener('click', (e) => {
    const prevBtn = e.target.closest('[data-carousel-prev]');
    const nextBtn = e.target.closest('[data-carousel-next]');
    const dot = e.target.closest('[data-carousel-dot]');
    const addBtn = e.target.closest('[data-add]');
    const navigate = e.target.closest('[data-navigate]');

    if (prevBtn) {
      e.stopPropagation();
      moveCarousel(prevBtn.dataset.carouselPrev, -1);
      return;
    }
    if (nextBtn) {
      e.stopPropagation();
      moveCarousel(nextBtn.dataset.carouselNext, 1);
      return;
    }
    if (dot) {
      e.stopPropagation();
      moveCarousel(dot.dataset.carouselDot, 0, parseInt(dot.dataset.index, 10));
      return;
    }
    if (addBtn) {
      e.stopPropagation();
      const product = PRODUCTS.find((p) => p.id === addBtn.dataset.add);
      if (product && product.customFields?.length > 0) {
        window.location.href = `/product.html?id=${product.id}`;
        return;
      }
      const color = product ? getSelectedColor(product) : null;
      addToCart(addBtn.dataset.add, color);
      return;
    }
    if (navigate) {
      window.location.href = `/product.html?id=${navigate.dataset.navigate}`;
    }
  });

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    loadSiteChrome();
  });

  document.addEventListener('chrome:ready', async () => {
    try {
      PRODUCTS = await getProducts();
    } catch (e) {
      grid.innerHTML =
          '<div class="empty-state">Não foi possível carregar a loja.</div>';
      return;
    }
    initCartDrawer(PRODUCTS);
    renderGrid();
  });
})();