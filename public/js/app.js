(function () {
  'use strict';

  let PRODUCTS = [];
  let activeCategory = 'todos';

  const grid = document.getElementById('productGrid');
  const categoryBar = document.getElementById('categoryBar');
  const yearEl = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- rendering: product grid ----------
  function renderGrid() {
    const items =
        activeCategory === 'todos'
            ? PRODUCTS
            : PRODUCTS.filter((p) => p.category === activeCategory);

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
            <span class="card-category">${CATEGORY_LABELS[p.category] || p.category}</span>
            <h3 class="card-name">${p.name}</h3>
            <p class="card-desc">${p.description}</p>
            ${renderColorSwatches(p)}
            <div class="card-footer">
              <span class="card-price">${formatPrice(p.price)}</span>
              <button class="add-btn" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </article>
      `
        )
        .join('');
  }

  // ---------- category filter ----------
  categoryBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    categoryBar.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === btn));
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
      const color = product ? getSelectedColor(product) : null;
      addToCart(addBtn.dataset.add, color);
      return;
    }
    if (navigate) {
      window.location.href = `/product.html?id=${navigate.dataset.navigate}`;
    }
  });

  // ---------- mobile nav toggle ----------
  const navToggle = document.getElementById('navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const nav = document.querySelector('.main-nav');
      const isOpen = nav.style.display === 'flex';
      nav.style.cssText = isOpen
          ? ''
          : 'display:flex; position:absolute; top:100%; left:0; right:0; flex-direction:column; background:var(--cream-soft); padding:18px 24px; gap:16px; border-bottom:1px solid var(--line);';
    });
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    loadSiteChrome();
  });

  document.addEventListener('chrome:ready', async () => {
    try {
      const res = await fetch('/api/products');
      PRODUCTS = await res.json();
    } catch (e) {
      grid.innerHTML =
          '<div class="empty-state">Não foi possível carregar a loja. Confirma que o servidor está a correr (npm start).</div>';
      return;
    }
    initCartDrawer(PRODUCTS); // drawer.js — the ONLY renderCart now
    renderGrid();
  });
})();