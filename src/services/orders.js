const crypto = require('crypto');
const { airtable, maxQtyPerLine } = require('../config');
const { createRecord } = require('../airtable/client');
const { isPricedPerChar, normalizeName, countChars, isValidName, linePrice } = require('../../public/js/pricing');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Error whose message is safe to show to the customer (returned as a 400).
class OrderValidationError extends Error {}

function roundCents(n) {
  return Math.round(n * 100) / 100;
}

function parseQty(raw) {
  return Math.max(1, Math.min(maxQtyPerLine, parseInt(raw, 10) || 1));
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Keeps only the fields we use, as trimmed strings.
function parseCustomer(raw) {
  const customer = {
    name: cleanString(raw?.name),
    email: cleanString(raw?.email),
    phone: cleanString(raw?.phone),
    address: cleanString(raw?.address),
  };
  if (!customer.name || !customer.email || !customer.address) {
    throw new OrderValidationError('Faltam dados de contacto ou morada.');
  }
  if (!EMAIL_PATTERN.test(customer.email)) {
    throw new OrderValidationError('O email indicado não é válido.');
  }
  return customer;
}

// Only accept a color the product actually comes in.
function resolveColor(product, color) {
  return product.images.some((img) => img.color && img.color === color) ? color : null;
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
    } else if (field.type === 'time' && !TIME_PATTERN.test(value)) {
      return null;
    } else if (field.type === 'boolean' && value !== 'Sim' && value !== 'Não') {
      return null;
    }
    values.push({ label: field.label, value });
  }
  return values;
}

// Turns raw cart lines into priced order lines. Unknown products are dropped.
function resolveOrderItems(rawItems, productsById) {
  const items = [];
  for (const raw of rawItems) {
    const product = productsById.get(raw?.id);
    if (!product) continue;
    const customValues = resolveCustomValues(product, raw.customValues);
    if (customValues === null) {
      throw new OrderValidationError(`A personalização de "${product.name}" não é válida.`);
    }
    items.push({
      name: product.name,
      qty: parseQty(raw.qty),
      price: linePrice(product, customValues),
      size: product.size,
      color: resolveColor(product, raw.color),
      customValues,
    });
  }
  return items;
}

// Minimal { size, qty } lines for a shipping quote. Unknown products are dropped.
function resolveShippingItems(rawItems, productsById) {
  return rawItems
    .map((raw) => ({ product: productsById.get(raw?.id), qty: parseQty(raw?.qty) }))
    .filter(({ product }) => product)
    .map(({ product, qty }) => ({ size: product.size, qty }));
}

function subtotalOf(items) {
  return roundCents(items.reduce((sum, it) => sum + it.price * it.qty, 0));
}

function generateReference() {
  return `PL-${crypto.randomInt(100000, 1000000)}`;
}

function formatEur(n) {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatItemsForAirtable(items) {
  return items
    .map((it) => {
      let line = `${it.qty}x ${it.name}`;
      if (it.color) line += ` (cor ${it.color})`;
      if (it.customValues.length) {
        line += ' — ' + it.customValues.map((cv) => `${cv.label}: ${cv.value}`).join(', ');
      }
      return `${line} — ${formatEur(it.price * it.qty)}`;
    })
    .join('\n');
}

async function saveOrder(order) {
  return createRecord(airtable.tables.orders, {
    reference: order.reference,
    status: 'Pendente',
    client_name: order.customer.name,
    email: order.customer.email,
    phone_number: order.customer.phone,
    address: order.customer.address,
    items: formatItemsForAirtable(order.items),
    subtotal: order.subtotal,
    fees: order.shipping,
    total: order.total,
  });
}

module.exports = {
  OrderValidationError,
  roundCents,
  parseCustomer,
  resolveOrderItems,
  resolveShippingItems,
  subtotalOf,
  generateReference,
  saveOrder,
};
