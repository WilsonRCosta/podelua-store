require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;

const hasStripeKey = !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_');
const stripe = hasStripeKey ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const isPublicHttps = DOMAIN.startsWith('https://');

const PRODUCTS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'products.json'), 'utf-8')
);
const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---------------------------------------------------------------

// Product catalog, read by the storefront on load.
app.get('/api/products', (req, res) => {
  res.json(PRODUCTS);
});

// Lets the frontend know whether Stripe test keys have been configured,
// so the UI can show a friendly setup notice instead of a broken button.
app.get('/api/config', (req, res) => {
  res.json({ stripeConfigured: hasStripeKey });
});

// Creates a Stripe Checkout Session from a cart of { id, qty } pairs.
// Prices are always looked up server-side from products.json, never trusted
// from the client, so nobody can tamper with amounts in the browser.
app.post('/api/create-checkout-session', async (req, res) => {
  if (!hasStripeKey) {
    return res.status(400).json({
      error:
        'Stripe ainda não está configurado. Adiciona a tua STRIPE_SECRET_KEY ao ficheiro .env (vê .env.example).',
    });
  }

  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'O carrinho está vazio.' });
    }

    const line_items = [];
    for (const item of items) {
      const product = PRODUCTS_BY_ID[item.id];
      const qty = Math.max(1, Math.min(20, parseInt(item.qty, 10) || 1));
      if (!product) continue;

      const productData = {
        name: product.name,
        description: product.description,
        metadata: { id: product.id },
      };
      if (isPublicHttps && product.images && product.images[0]) {
        const src = product.images[0];
        productData.images = [src.startsWith('http') ? src : `${DOMAIN}${src}`];
      }

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: product.price,
          product_data: productData,
        },
      });
    }

    if (line_items.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto válido no carrinho.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pt',
      line_items,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['PT', 'ES', 'FR', 'DE', 'IT', 'GB', 'US', 'BR'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 450, currency: 'eur' },
            display_name: 'Envio normal (3-5 dias úteis)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ],
      success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/cancel.html`,
      metadata: { store: 'podelua' },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Não foi possível iniciar o pagamento. Tenta novamente.' });
  }
});

// Lets success.html show a short order confirmation summary.
app.get('/api/session/:id', async (req, res) => {
  if (!hasStripeKey) return res.status(400).json({ error: 'Stripe não configurado.' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ['line_items'],
    });
    res.json({
      email: session.customer_details?.email || null,
      amount_total: session.amount_total,
      currency: session.currency,
      items: session.line_items?.data.map((li) => ({
        name: li.description,
        quantity: li.quantity,
        amount: li.amount_total,
      })) || [],
    });
  } catch (err) {
    console.error('Session lookup error:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar a encomenda.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌙 Pó de Lua a correr em http://localhost:${PORT}`);
  if (!hasStripeKey) {
    console.log('   ⚠️  STRIPE_SECRET_KEY não definida — o checkout ficará em modo de aviso.');
    console.log('   Copia .env.example para .env e adiciona as tuas chaves de teste Stripe.\n');
  }
});
