const express = require('express');
const { getProducts, getProductsById } = require('../services/products');
const { calculateShippingCost } = require('../services/shipping');
const { sendOrderConfirmationEmail } = require('../services/mailer');
const {
  OrderValidationError,
  roundCents,
  parseCustomer,
  resolveOrderItems,
  resolveShippingItems,
  subtotalOf,
  generateReference,
  saveOrder,
} = require('../services/orders');

const router = express.Router();

router.get('/products', async (req, res) => {
  try {
    const products = (await getProducts()).map(toPublic);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=1800, stale-while-revalidate=3600');
    res.json(products);
  } catch (err) {
    console.error('Airtable fetch error:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os produtos.' });
  }
});

router.get('/img/:productId/:attId', async (req, res) => {
  try {
    const product = (await getProductsById()).get(req.params.productId);
    const img = product?.images.find((i) => i.url.endsWith(`/${req.params.attId}`));
    if (!img) return res.sendStatus(404);

    const src = req.query.s === 'large' ? img.thumbSourceUrl : img.sourceUrl;
    const up = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!up.ok) return res.sendStatus(502);

    res.set('Content-Type', up.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    res.send(Buffer.from(await up.arrayBuffer()));
  } catch (e) {
    console.error('Image proxy error:', e.message);
    res.sendStatus(502);
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'O carrinho está vazio.' });
    }
    const customer = parseCustomer(req.body.customer);

    const items = resolveOrderItems(rawItems, await getProductsById());
    if (items.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto válido no carrinho.' });
    }

    const subtotal = subtotalOf(items);
    const shipping = await calculateShippingCost(items);
    const total = roundCents(subtotal + shipping);
    const order = { reference: generateReference(), items, subtotal, shipping, total, customer };

    await saveOrder(order);

    // The order is already saved: a failed email must not make the customer retry and order twice.
    try {
      await sendOrderConfirmationEmail(order);
    } catch (err) {
      console.error(`Order ${order.reference} saved but confirmation email failed:`, err.message);
    }

    res.json({ reference: order.reference, total });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Create order error:', err.message);
    res.status(500).json({ error: 'Não foi possível criar a encomenda. Tenta novamente.' });
  }
});

router.post('/shipping-quote', async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = resolveShippingItems(rawItems, await getProductsById());
    res.json({ shippingCost: await calculateShippingCost(items) });
  } catch (err) {
    console.error('Shipping quote error:', err.message);
    res.status(500).json({ error: 'Não foi possível calcular o envio.' });
  }
});

function toPublic(p) {
  return { ...p, images: p.images.map(({ url, thumb, color }) => ({ url, thumb, color })) };
}

module.exports = router;
