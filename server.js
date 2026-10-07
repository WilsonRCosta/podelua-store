require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { buildOrderConfirmationEmail } = require('./email-templates');
const { isPricedPerChar, normalizeName, countChars, isValidName, linePrice } = require('./public/js/pricing');

const app = express();
const PORT = process.env.PORT || 3000;

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

const PRODUCTS_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE;
const CUSTOM_TABLE = process.env.AIRTABLE_CUSTOM_TABLE;
const ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE;
const SIZES_TABLE = process.env.AIRTABLE_SIZES_TABLE;
const QUOTAS_TABLE = process.env.AIRTABLE_QUOTAS_TABLE;
const MAX_QTY_PER_LINE = 3;

const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ---------- Airtable: products ----------

// Internal product id derived from the name. Case, accents and extra spaces don't matter.
function productIdFromName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapRecord(record) {
  const f = record.fields;
  const colors = (f.colors || '').split(',').map((c) => c.trim()).filter(Boolean);
  const images = (f.images || []).map((img, i) => ({ url: img.url, color: colors[i] || null }));

  return {
    id: productIdFromName(f.name),
    name: f.name,
    categories: f.categories || [],
    price: f.price,
    size: f.size || null,
    description: f.description || '',
    longDescription: f.long_description || '',
    images,
    createdAt: f.created_at || record.createdTime,
  };
}

function getUrl(table) {
  return new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`);
}

async function fetchFromAirtable(url) {
  return await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
}

async function fetchCustomFieldsMap() {
  let allRecords = [];
  let offset = null;

  do {
    const url = getUrl(CUSTOM_TABLE);
    url.searchParams.set('sort[0][field]', 'order');
    url.searchParams.set('sort[0][direction]', 'asc');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetchFromAirtable(url);
    if (!res.ok) throw new Error(`Airtable (Personalização) respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  const TYPE_MAP = { Texto: 'text', Inteiro: 'integer', Decimal: 'decimal', Data: 'date', Hora: 'time', Booleano: 'boolean' };
  const map = {};
  for (const record of allRecords) {
    const f = record.fields;
    const productId = productIdFromName(f.product);
    if (!productId) continue;
    if (!map[productId]) map[productId] = [];
    map[productId].push({
      label: f.label,
      type: TYPE_MAP[f.type] || 'text',
      limit: f.limit || (TYPE_MAP[f.type] === 'decimal' ? 2 : 50),
      // Only text fields can be priced per letter
      pricePerChar: (TYPE_MAP[f.type] || 'text') === 'text' ? Number(f.price_per_char) || 0 : 0,
      includedChars: Math.max(0, parseInt(f.included_chars, 10) || 0),
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
    url.searchParams.set('sort[0][field]', 'created_at');
    url.searchParams.set('sort[0][direction]', 'desc');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetchFromAirtable(url);
    if (!res.ok) throw new Error(`Airtable (Produtos) respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  const customFieldsMap = await fetchCustomFieldsMap();
  const products = [];
  const seen = new Set();
  for (const record of allRecords) {
    const product = mapRecord(record);
    if (!product.id) continue;
    if (seen.has(product.id)) {
      console.warn(`[products] ignoring "${product.name}": another active product has the same name`);
      continue;
    }
    seen.add(product.id);
    product.customFields = customFieldsMap[product.id] || [];
    products.push(product);
  }
  return products;
}

async function fetchProductById(id) {
  const products = await getCachedProducts();
  return products.find((p) => p.id === id) || null;
}

async function fetchSizeUnitsMap() {
  let allRecords = [];
  let offset = null;
  do {
    const url = getUrl(SIZES_TABLE);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetchFromAirtable(url);
    if (!res.ok) throw new Error(`Airtable (Tamanhos) respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  const map = {};
  for (const record of allRecords) {
    map[record.fields.size] = record.fields.units;
  }
  return map; // { XS: 1, S: 2, M: 4, L: 8 }
}

async function fetchQuotas() {
  let allRecords = [];
  let offset = null;
  do {
    const url = getUrl(QUOTAS_TABLE);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetchFromAirtable(url);
    if (!res.ok) throw new Error(`Airtable (Escalões de Envio) respondeu ${res.status}`);
    const data = await res.json();
    allRecords = allRecords.concat(data.records);
    offset = data.offset;
  } while (offset);

  return allRecords
      .map((r) => ({ min: r.fields.min_units, max: r.fields.max_units, price: r.fields.price }))
      .sort((a, b) => a.min - b.min);
}

// -------  CACHE  --------- //

const CACHE_TTL_MS = 30 * 1000;

let productsCache = { data: null, fetchedAt: 0 };
let shippingCache = { data: null, fetchedAt: 0 };

async function getCachedProducts() {
  const isFresh = productsCache.data && Date.now() - productsCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return productsCache.data;
  const products = await fetchProducts();
  productsCache = { data: products, fetchedAt: Date.now() };
  return products;
}

async function getCachedShippingConfig() {
  const isFresh = shippingCache.data && Date.now() - shippingCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return shippingCache.data;
  try {
    const [sizeUnits, quotas] = await Promise.all([fetchSizeUnitsMap(), fetchQuotas()]);
    shippingCache = { data: { sizeUnits, quotas }, fetchedAt: Date.now() };
  } catch (err) {
    console.error('Shipping config fetch error:', err.message);
    return shippingCache.data || { sizeUnits: {}, quotas: [] };
  }
  return shippingCache.data;
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

async function calculateShippingCost(items) {
  const { sizeUnits, quotas } = await getCachedShippingConfig();
  let totalUnits = 0;
  for (const item of items) {
    const unitsPerItem = sizeUnits[item.size] ?? 1;
    totalUnits += unitsPerItem * item.qty;
  }
  const tier = quotas.find((t) => totalUnits >= t.min && totalUnits <= t.max);
  return tier ? tier.price : (quotas[quotas.length - 1]?.price ?? 4.5);
}

// Rebuilds the customization from the product's own fields, so the client can't skip a field,
// go over a limit or sneak spaces/symbols into a name priced per letter. Returns null when invalid.
function resolveCustomValues(product, rawValues) {
  const raw = Array.isArray(rawValues) ? rawValues : [];
  const values = [];
  for (const field of product.customFields || []) {
    const cv = raw.find((v) => v && v.label === field.label);
    let value = String(cv?.value ?? '').trim();
    if (!value) return null;
    if (isPricedPerChar(field)) {
      value = normalizeName(value);
      if (!isValidName(value) || countChars(value) > field.limit) return null;
    } else if (field.type === 'text' && value.length > field.limit) {
      return null;
    } else if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      return null;
    } else if (field.type === 'boolean' && value !== 'Sim' && value !== 'Não') {
      return null;
    }
    values.push({ label: field.label, value });
  }
  return values;
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
    const { items, customer } = req.body;

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
      const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, parseInt(item.qty, 10) || 1));
      const customValues = resolveCustomValues(product, item.customValues);
      if (customValues === null) {
        return res.status(400).json({ error: `A personalização de "${product.name}" não é válida.` });
      }
      const price = linePrice(product, customValues);
      subtotal += price * qty;
      resolvedItems.push({
        name: product.name,
        qty,
        price,
        size: product.size,
        color: item.color || null,
        customValues,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto válido no carrinho.' });
    }

    const shipping = await calculateShippingCost(resolvedItems.map((it) => ({ size: it.size, qty: it.qty })));
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

app.post('/api/shipping-quote', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const resolved = [];
    for (const item of items) {
      const product = await fetchProductById(item.id);
      if (!product) continue;
      const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, parseInt(item.qty, 10) || 1));
      resolved.push({ size: product.size, qty });
    }
    const shippingCost = await calculateShippingCost(resolved);
    res.json({ shippingCost });
  } catch (err) {
    console.error('Shipping quote error:', err.message);
    res.status(500).json({ error: 'Não foi possível calcular o envio.' });
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