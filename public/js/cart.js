// public/js/cart.js
const CART_KEY = 'podelua-cart-v1';
const MAX_QTY_PER_LINE = 3;

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
function cartKey(id, color, customValues) {
    if (customValues && customValues.length > 0) {
        // Each personalized add is its own line — two different names shouldn't collapse into one quantity
        return `${id}::${color || 'default'}::${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return `${id}::${color || 'default'}`;
}

function showToast(msg) {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function addToCart(id, color, showFeedback = true, customValues = []) {
    const key = cartKey(id, color, customValues);
    if (!cart[key]) {
        cart[key] = { id, color: color || null, qty: 0, customValues: customValues.length ? customValues : null };
    }
    if (cart[key].qty >= MAX_QTY_PER_LINE) {
        if (showFeedback) showToast(`Máximo de ${MAX_QTY_PER_LINE} unidades por produto`);
        return;
    }
    cart[key].qty += 1;
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    if (typeof onCartChanged === 'function') onCartChanged();
    if (showFeedback && typeof showToast === 'function') {
        showToast('Adicionado ao carrinho');
    }
}

function incrCart(key) {
    if (!cart[key]) return;
    if (cart[key].qty >= MAX_QTY_PER_LINE) {
        showToast(`Máximo de ${MAX_QTY_PER_LINE} unidades por produto`);
        return;
    }
    cart[key].qty += 1;
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    if (typeof onCartChanged === 'function') onCartChanged();
}

function decrCart(key) {
    if (!cart[key]) return;
    cart[key].qty -= 1;
    if (cart[key].qty <= 0) delete cart[key];
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    if (typeof onCartChanged === 'function') onCartChanged();
}

function removeFromCart(key) {
    delete cart[key];
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    if (typeof onCartChanged === 'function') onCartChanged();
}