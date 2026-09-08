require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;

const hasStripeKey = !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_');
const stripe = hasStripeKey ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const isPublicHttps = DOMAIN.startsWith('https://');

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

// ---------- Airtable helpers ----------

// Maps one Airtable record into the shape the storefront and checkout expect.
function mapRecord(record) {
  const f = record.fields;

  const colors = (f.colors || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

  const images = (f.images || []).map((img, i) => ({
    url: img.url,
    color: colors[i] || null,
  }));

  return {
    id: f.id,
    name: f.name,
    categories: (f.categories || []),
    price: f.price,
    description: f.description || '',
    longDescription: f.long_description || '',
    images,
  };
}

// Fetches every active product, paginating past Airtable's 100-record page limit.
async function fetchProducts() {
  let allRecords = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`);
    url.searchParams.set('filterByFormula', '{active} = 1');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) throw new Error(`Airtable respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  return allRecords.map(mapRecord);
}

async function fetchProductById(id) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`);
  url.searchParams.set('filterByFormula', `{id} = '${id}'`);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable respondeu ${res.status}`);
  const data = await res.json();
  const record = data.records[0];
  return record ? mapRecord(record) : null;
}

// ---------- lightweight cache ----------
// Avoids hitting Airtable on every single page load, while still picking up
// edits within a short window instead of needing a server restart.
let productsCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function getCachedProducts() {
  const isFresh = productsCache.data && Date.now() - productsCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return productsCache.data;

  const products = await fetchProducts();
  productsCache = { data: products, fetchedAt: Date.now() };
  return products;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---------------------------------------------------------------

app.get('/api/products', async (req, res) => {
  try {
    const products = await getCachedProducts();
    res.json(products);
  } catch (err) {
    console.error('Airtable fetch error:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os produtos.' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ stripeConfigured: hasStripeKey });
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!hasStripeKey) {
    return res.status(400).json({
      error: 'Stripe ainda não está configurado. Adiciona a tua STRIPE_SECRET_KEY ao ficheiro .env (vê .env.example).',
    });
  }

  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'O carrinho está vazio.' });
    }

    const line_items = [];
    for (const item of items) {
      const product = await fetchProductById(item.id);
      const qty = Math.max(1, Math.min(5, parseInt(item.qty, 10) || 1));
      if (!product) continue;

      const productData = {
        name: product.name,
        description: product.description,
        metadata: { id: product.id },
      };
      if (isPublicHttps && product.images && product.images[0]) {
        const src = product.images[0].url;
        productData.images = [src.startsWith('http') ? src : `${DOMAIN}${src}`];
      }

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(product.price * 100),
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

app.get('/api/session/:id', async (req, res) => {
  if (!hasStripeKey) return res.status(400).json({ error: 'Stripe não configurado.' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, { expand: ['line_items'] });
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🌙 Pó de Lua listening on http://localhost:${PORT}`);

    if (!hasStripeKey) {
      console.log('   ⚠️  STRIPE_SECRET_KEY not defined — checkout will be in warning mode.');
    }
    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      console.log('   ⚠️  Airtable not configured — /api/products will fail.');
    }
  });
}

module.exports = app;