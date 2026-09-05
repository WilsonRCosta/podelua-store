// Cart drawer UI, shared between index.html and product.html.
// DOM refs are grabbed lazily, only once the header/cart-drawer
// partials have actually been injected — never at script-load time.

let cartDrawerEl, overlayEl, cartItemsEl, cartCountEl, cartSubtotalEl, checkoutBtn, checkoutWarning;
let PRODUCTS = []; // populated by whichever page loads first

function initCartDrawer(products) {
    PRODUCTS = products;

    cartDrawerEl = document.getElementById('cartDrawer');
    overlayEl = document.getElementById('overlay');
    cartItemsEl = document.getElementById('cartItems');
    cartCountEl = document.getElementById('cartCount');
    cartSubtotalEl = document.getElementById('cartSubtotal');
    checkoutBtn = document.getElementById('checkoutBtn');
    checkoutWarning = document.getElementById('checkoutWarning');

    document.getElementById('openCart').addEventListener('click', openCartDrawer);
    document.getElementById('closeCart').addEventListener('click', closeCartDrawer);
    overlayEl.addEventListener('click', closeCartDrawer);

    cartItemsEl.addEventListener('click', (e) => {
        const incr = e.target.closest('[data-incr]');
        const decr = e.target.closest('[data-decr]');
        const remove = e.target.closest('[data-remove]');
        if (incr) incrCart(incr.dataset.incr);
        if (decr) decrCart(decr.dataset.decr);
        if (remove) removeFromCart(remove.dataset.remove);
    });

    checkoutBtn.addEventListener('click', startCheckout);

    loadStripeConfig().then(renderCart);
}

function openCartDrawer() {
    cartDrawerEl.classList.add('open');
    overlayEl.classList.add('open');
}
function closeCartDrawer() {
    cartDrawerEl.classList.remove('open');
    overlayEl.classList.remove('open');
}

function renderCart() {
    if (!cartItemsEl) return;
    const entries = Object.entries(cart).filter(([, line]) => line.qty > 0);
    let count = 0, subtotal = 0;

    if (entries.length === 0) {
        cartItemsEl.innerHTML = `<div class="cart-empty"><p>O teu carrinho está vazio.</p></div>`;
    } else {
        cartItemsEl.innerHTML = entries.map(([key, line]) => {
            const p = PRODUCTS.find((x) => x.id === line.id);
            if (!p) return '';
            count += line.qty;
            subtotal += p.price * line.qty;

            const images = p.images || [];
            // find the image matching this line's saved color; fall back to the first photo
            // when the product has no colors at all, or the match can't be found
            const matchedIndex = line.color ? images.findIndex((img) => img.color === line.color) : -1;
            const displayImg = images[matchedIndex >= 0 ? matchedIndex : 0];

            return `
        <div class="cart-line">
          <div class="cart-line-art">
            <img src="${displayImg?.url || '/images/placeholder.png'}" alt="${p.name}" />
          </div>
          <div class="cart-line-info">
            <h4>${p.name}</h4>
            ${line.color ? `<span class="cart-line-color" style="background:${line.color}"></span>` : ''}
            <div class="cart-line-price">${formatPrice(p.price)}</div>
            <div class="qty-stepper">
              <button data-decr="${key}" aria-label="Diminuir quantidade">−</button>
              <span>${line.qty}</span>
              <button data-incr="${key}" aria-label="Aumentar quantidade">+</button>
            </div>
            <button class="remove-line" data-remove="${key}">Remover</button>
          </div>
        </div>`;
        }).join('');
    }

    cartCountEl.textContent = count;
    cartCountEl.dataset.empty = count === 0 ? 'true' : 'false';
    cartSubtotalEl.textContent = formatPrice(subtotal);
    checkoutBtn.disabled = count === 0;
}