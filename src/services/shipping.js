const { airtable } = require('../config');
const { fetchAllRecords } = require('../airtable/client');
const { createCache } = require('../cache');

const DEFAULT_UNITS_PER_ITEM = 1;
const FALLBACK_SHIPPING_PRICE = 4.5;

async function fetchSizeUnitsMap() {
  const records = await fetchAllRecords(airtable.tables.sizes, { label: 'Tamanhos' });
  const map = {};
  for (const { fields } of records) map[fields.size] = fields.units;
  return map; // { XS: 1, S: 2, M: 4, L: 8 }
}

async function fetchQuotas() {
  const records = await fetchAllRecords(airtable.tables.quotas, { label: 'Escalões de Envio' });
  return records
    .map(({ fields }) => ({ min: fields.min_units, max: fields.max_units, price: fields.price }))
    .sort((a, b) => a.min - b.min);
}

const getFreshShippingConfig = createCache(async () => {
  const [sizeUnits, quotas] = await Promise.all([fetchSizeUnitsMap(), fetchQuotas()]);
  return { sizeUnits, quotas };
});

// Falls back to the last known config (or an empty one) so a flaky Airtable doesn't block checkout.
async function getShippingConfig() {
  try {
    return await getFreshShippingConfig();
  } catch (err) {
    console.error('Shipping config fetch error:', err.message);
    return getFreshShippingConfig.stale() || { sizeUnits: {}, quotas: [] };
  }
}

// `items`: [{ size, qty }]
async function calculateShippingCost(items) {
  const { sizeUnits, quotas } = await getShippingConfig();
  const totalUnits = items.reduce(
    (sum, item) => sum + (sizeUnits[item.size] ?? DEFAULT_UNITS_PER_ITEM) * item.qty,
    0,
  );
  const tier = quotas.find((t) => totalUnits >= t.min && totalUnits <= t.max);
  return tier ? tier.price : (quotas[quotas.length - 1]?.price ?? FALLBACK_SHIPPING_PRICE);
}

module.exports = { calculateShippingCost };
