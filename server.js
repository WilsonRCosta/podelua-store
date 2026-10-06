require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { buildOrderConfirmationEmail } = require('./email-templates');

const app = express();
const PORT = process.env.PORT || 3000;

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const PRODUCTS_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE;
const CUSTOM_TABLE = process.env.AIRTABLE_CUSTOM_TABLE;
const ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ---------- Airtable: products ----------

function mapRecord(record) {
  const f = record.fields;
  const colors = (f.colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  const images = (f.images || []).map((img, i) => ({ url: img.url, color: colors[i] || null }));

  return {
    id: f.id,
    name: f.name,
    categories: f.categories || [],
    price: f.price,
    description: f.description || '',
    longDescription: f.long_description || '',
    images,
  };
}

function getUrl(table) {
  return new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`);
}

async function fetchCustomFieldsMap() {
  let allRecords = [];
  let offset = null;

  do {
    const url = getUrl(CUSTOM_TABLE);
    url.searchParams.set('sort[0][field]', 'order');
    url.searchParams.set('sort[0][direction]', 'asc');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) throw new Error(`Airtable (Personalização) respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  const TYPE_MAP = { Texto: 'text', Inteiro: 'integer', Decimal: 'decimal', Data: 'date' };
  const map = {};
  for (const record of allRecords) {
    const f = record.fields;
    const productId = f['product-id'];
    if (!productId) continue;
    if (!map[productId]) map[productId] = [];
    map[productId].push({
      label: f.label,
      type: TYPE_MAP[f.type] || 'text',
      limit: f.limit || (TYPE_MAP[f.type] === 'decimal' ? 2 : 50),
    });
  }
  return map;
}

async function fetchProducts() {
  let allRecords = [];
  let offset = null;
  do {
    const url = getUrl(PRODUCTS_TABLE);
    url.searchParams.set('filterByFormula', '{active} = 1');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) throw new Error(`Airtable respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  const customFieldsMap = await fetchCustomFieldsMap();
  return allRecords.map((record) => {
    const product = mapRecord(record);
    product.customFields = customFieldsMap[product.id] || [];
    return product;
  });
}

let productsCache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 1000;

async function getCachedProducts() {
  const isFresh = productsCache.data && Date.now() - productsCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return productsCache.data;
  const products = await fetchProducts();
  productsCache = { data: products, fetchedAt: Date.now() };
  return products;
}

async function fetchProductById(id) {
  const products = await getCachedProducts();
  return products.find((p) => p.id === id) || null;
}

// ---------- Airtable: orders ----------

function generateReference() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `PL-${num}`;
}

function formatItemsForAirtable(items) {
  return items
      .map((it) => {
        let line = `${it.qty}x ${it.name}`;
        if (it.color) line += ` (cor ${it.color})`;
        if (it.customValues && it.customValues.length) {
          line += ' — ' + it.customValues.map((cv) => `${cv.label}: ${cv.value}`).join(', ');
        }
        line += ` — ${(it.price * it.qty).toFixed(2).replace('.', ',')} €`;
        return line;
      })
      .join('\n');
}

async function createOrderRecord(order) {
  const url = getUrl(ORDERS_TABLE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        reference: order.reference,
        status: 'Pendente',
        client_name: order.customer.name,
        email: order.customer.email,
        phone_number: order.customer.phone || '',
        address: order.customer.address,
        items: formatItemsForAirtable(order.items),
        subtotal: order.subtotal,
        fees: order.shipping,
        total: order.total,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable order write failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function sendOrderConfirmationEmail(order) {
  const { subject, html, text } = buildOrderConfirmationEmail(order, {
    iban: process.env.BANK_IBAN,
    holder: process.env.BANK_HOLDER,
  });

  await mailTransport.sendMail({
    from: `"Pó de Lua" <${process.env.GMAIL_USER}>`,
    to: order.customer.email,
    bcc: process.env.GMAIL_USER,
    subject,
    html,
    text,
  });
}

// ---------- API ----------

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', async (req, res) => {
  try {
    res.json(await getCachedProducts());
  } catch (err) {
    console.error('Airtable fetch error:', err.message);
    res.status(500).json({ error: 'Não foi possível carregar os produtos.' });
  }
});

app.post('/api/create-order', async (req, res) => {
  try {
    const { items, customer, shippingMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'O carrinho está vazio.' });
    }
    if (!customer || !customer.name || !customer.email || !customer.address) {
      return res.status(400).json({ error: 'Faltam dados de contacto ou morada.' });
    }

    const resolvedItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await fetchProductById(item.id);
      if (!product) continue;
      const qty = Math.max(1, Math.min(5, parseInt(item.qty, 10) || 1));
      subtotal += product.price * qty;
      resolvedItems.push({
        name: product.name,
        qty,
        price: product.price,
        color: item.color || null,
        customValues: item.customValues || [],
      });
    }

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto válido no carrinho.' });
    }

    const shipping = shippingMethod === 'pickup' ? 0 : 4.5;
    const total = Math.round((subtotal + shipping) * 100) / 100;
    const reference = generateReference();

    const order = { reference, items: resolvedItems, subtotal, shipping, total, customer };

    await createOrderRecord(order);
    await sendOrderConfirmationEmail(order);

    res.json({ reference, total });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ error: 'Não foi possível criar a encomenda. Tenta novamente.' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🌙 Pó de Lua listening on http://localhost:${PORT}`);
    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      console.log('   ⚠️  Airtable not configured.');
    }
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('   ⚠️  Gmail not configured — order emails will fail.');
    }
  });
}

module.exports = app;