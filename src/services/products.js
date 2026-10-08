const { airtable } = require('../config');
const { fetchAllRecords } = require('../airtable/client');
const { createCache } = require('../cache');

const TYPE_MAP = { Texto: 'text', Inteiro: 'integer', Decimal: 'decimal', Data: 'date', Hora: 'time', Booleano: 'boolean' };

// Internal product id derived from the name. Case, accents and extra spaces don't matter.
function productIdFromName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapProduct(record) {
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

function mapCustomField(f) {
  const type = TYPE_MAP[f.type] || 'text';
  return {
    label: f.label,
    type,
    limit: f.limit || (type === 'decimal' ? 2 : 50),
    // Only text fields can be priced per letter
    pricePerChar: type === 'text' ? Number(f.price_per_char) || 0 : 0,
    includedChars: Math.max(0, parseInt(f.included_chars, 10) || 0),
  };
}

async function fetchCustomFieldsMap() {
  const records = await fetchAllRecords(airtable.tables.custom, {
    label: 'Personalização',
    params: { 'sort[0][field]': 'order', 'sort[0][direction]': 'asc' },
  });

  const map = {};
  for (const { fields } of records) {
    const productId = productIdFromName(fields.product);
    if (!productId) continue;
    (map[productId] ||= []).push(mapCustomField(fields));
  }
  return map;
}

async function fetchProducts() {
  const [records, customFieldsMap] = await Promise.all([
    fetchAllRecords(airtable.tables.products, {
      label: 'Produtos',
      params: {
        filterByFormula: '{active} = 1',
        'sort[0][field]': 'created_at',
        'sort[0][direction]': 'desc',
      },
    }),
    fetchCustomFieldsMap(),
  ]);

  const products = [];
  const seen = new Set();
  for (const record of records) {
    const product = mapProduct(record);
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

const getProducts = createCache(fetchProducts);

// Map of product id -> product, for resolving several cart lines at once.
async function getProductsById() {
  const products = await getProducts();
  return new Map(products.map((p) => [p.id, p]));
}

module.exports = { getProducts, getProductsById };
