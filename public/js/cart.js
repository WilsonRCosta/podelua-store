// public/js/cart.js
const CART_KEY = 'podelua-cart-v1';

function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch (e) { return {}; }
}
function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

let cart = loadCart(); // { [cartKey]: { id, color, qty } }

// Same product in two different colors = two separate cart lines.
// Same product with no color defined always collapses to one line.
function cartKey(id, color) {
    return `${id}::${color || 'default'}`;
}

let stripeConfigured = false;

function showToast(msg) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function loadStripeConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        stripeConfigured = !!config.stripeConfigured;
    } catch (e) {
        stripeConfigured = false;
    }
}

function addToCart(id, color, showFeedback = true) {
    const key = cartKey(id, color);
    if (!cart[key]) {
        cart[key] = { id, color: color || null, qty: 0 };
    }
    cart[key].qty += 1;
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    if (showFeedback && typeof showToast === 'function') {
        showToast('Adicionado ao carrinho');
    }
}

function incrCart(key) {
    if (!cart[key]) return;
    cart[key].qty += 1;
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
}

function decrCart(key) {
    if (!cart[key]) return;
    cart[key].qty -= 1;
    if (cart[key].qty <= 0) delete cart[key];
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
}

function removeFromCart(key) {
    delete cart[key];
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
}

async function startCheckout() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutWarning = document.getElementById('checkoutWarning');
    const items = Object.values(cart)
        .filter((line) => line.qty > 0)
        .map((line) => ({ id: line.id, qty: line.qty }));

    if (items.length === 0) return;

    if (!stripeConfigured) {
        if (checkoutWarning) checkoutWarning.classList.add('show');
        return;
    }

    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<span>A abrir pagamento…</span>';
    }

    try {
        const res = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
            throw new Error(data.error || 'Erro desconhecido');
        }
        window.location.href = data.url;
    } catch (err) {
        showToast(err.message || 'Não foi possível iniciar o pagamento.');
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<span>Finalizar compra</span>';
        }
    }
}