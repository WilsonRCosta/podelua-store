(function () {
    'use strict';

    let PRODUCTS = [];

    document.addEventListener('DOMContentLoaded', () => {
        loadSiteChrome();
    });

    document.addEventListener('chrome:ready', async () => {
        try {
            PRODUCTS = await getProducts();
        } catch (e) {
            document.getElementById('checkoutSummary').innerHTML = '<p>Não foi possível carregar o carrinho.</p>';
            return;
        }
        initCartDrawer(PRODUCTS);
        await renderSummary();
    });

    function getCartEntries() {
        return Object.entries(cart).filter(([, line]) => line.qty > 0);
    }

    async function renderSummary() {
        const summaryEl = document.getElementById('checkoutSummary');
        const entries = getCartEntries();

        if (entries.length === 0) {
            summaryEl.innerHTML = '<p>O teu carrinho está vazio.</p>';
            document.getElementById('checkoutForm').style.display = 'none';
            return;
        }
        document.getElementById('checkoutForm').style.display = '';

        let subtotal = 0;
        const itemsHtml = entries
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
            .join('');

        summaryEl.innerHTML =
            itemsHtml +
            `<div class="summary-line"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>` +
            `<div class="summary-line"><span>Envio</span><span id="summaryShipping">A calcular…</span></div>` +
            `<div class="summary-line summary-total"><span>Total</span><span id="summaryTotal">—</span></div>`;

        try {
            const items = entries.map(([, line]) => ({ id: line.id, qty: line.qty }));
            const { shippingCost } = await fetchShippingQuote(items);
            document.getElementById('summaryShipping').textContent = formatPrice(shippingCost);
            document.getElementById('summaryTotal').textContent = formatPrice(subtotal + shippingCost);
        } catch (e) {
            document.getElementById('summaryShipping').textContent = 'Erro ao calcular';
        }
    }

    window.onCartChanged = renderSummary;

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

        submitBtn.disabled = true;
        submitBtn.textContent = 'A confirmar…';

        try {
            const data = await createOrder({ items, customer });

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