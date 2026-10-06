(function () {
    'use strict';

    let PRODUCTS = [];

    document.addEventListener('DOMContentLoaded', () => {
        loadSiteChrome();
    });

    document.addEventListener('chrome:ready', async () => {
        try {
            PRODUCTS = await fetchProducts();
        } catch (e) {
            document.getElementById('checkoutSummary').innerHTML = '<p>Não foi possível carregar o carrinho.</p>';
            return;
        }
        initCartDrawer(PRODUCTS);
        renderSummary();
    });

    function getCartEntries() {
        return Object.entries(cart).filter(([, line]) => line.qty > 0);
    }

    function renderSummary() {
        const summaryEl = document.getElementById('checkoutSummary');
        const entries = getCartEntries();

        if (entries.length === 0) {
            summaryEl.innerHTML = '<p>O teu carrinho está vazio.</p>';
            document.getElementById('checkoutForm').style.display = 'none';
            return;
        }

        let subtotal = 0;
        summaryEl.innerHTML = entries
            .map(([, line]) => {
                const p = PRODUCTS.find((x) => x.id === line.id);
                if (!p) return '';
                subtotal += p.price * line.qty;
                return `
        <div class="summary-line">
          <span>${line.qty}× ${p.name}${line.color ? ` <span class="summary-color" style="background:${line.color}"></span>` : ''}</span>
          <span>${formatPrice(p.price * line.qty)}</span>
        </div>`;
            })
            .join('') + `<div class="summary-line summary-total"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>`;
    }

    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = document.getElementById('submitOrderBtn');

        const entries = getCartEntries();
        if (entries.length === 0) return;

        const items = entries.map(([, line]) => ({
            id: line.id,
            qty: line.qty,
            color: line.color || null,
            customValues: line.customValues || [],
        }));

        const customer = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            address: form.address.value.trim(),
        };
        const shippingMethod = form.shippingMethod.value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'A confirmar…';

        try {
            const res = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, customer, shippingMethod }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro desconhecido');

            // Order placed — clear the cart and show confirmation
            cart = {};
            saveCart(cart);
            if (typeof renderCart === 'function') renderCart();

            document.querySelector('.checkout-grid').style.display = 'none';
            document.querySelector('.checkout-title').style.display = 'none';
            const confirmEl = document.getElementById('checkoutConfirmation');
            confirmEl.style.display = 'block';
            confirmEl.innerHTML = `
        <h2>Encomenda confirmada 🌙</h2>
        <p>Referência <strong>${data.reference}</strong> — enviámos os detalhes de pagamento para o teu email.</p>
        <a href="/" class="btn btn-primary">Voltar à loja</a>
      `;
        } catch (err) {
            showToast(err.message || 'Não foi possível confirmar a encomenda.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar encomenda';
        }
    });
})();