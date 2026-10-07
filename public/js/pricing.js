// public/js/pricing.js
// Shared by the browser and server.js, so the price shown is always the price charged.

// Fields priced per letter hold a single name: letters only (accents allowed), no spaces/symbols.
const NAME_PATTERN = /^\p{L}+$/u;

function isPricedPerChar(field) {
    return field.pricePerChar > 0;
}

function normalizeName(value) {
    return String(value || '').normalize('NFC').trim();
}

function countChars(value) {
    return Array.from(normalizeName(value)).length;
}

function isValidName(value) {
    return NAME_PATTERN.test(normalizeName(value));
}

// Extra cost of one field: every letter above includedChars costs pricePerChar
function fieldExtra(field, value) {
    if (!isPricedPerChar(field)) return 0;
    return Math.max(0, countChars(value) - field.includedChars) * field.pricePerChar;
}

// Unit price of a cart line: base product price + per-letter extras
function linePrice(product, customValues) {
    const values = customValues || [];
    let price = Number(product.price);
    for (const field of product.customFields || []) {
        const cv = values.find((v) => v.label === field.label);
        price += fieldExtra(field, cv?.value);
    }
    return Math.round(price * 100) / 100;
}

// Cheapest possible price (a 1-letter name), used for "desde X €" on the listing
function minPrice(product) {
    const fields = product.customFields || [];
    return Math.round(fields.reduce((sum, f) => sum + fieldExtra(f, 'A'), Number(product.price)) * 100) / 100;
}

function hasVariablePrice(product) {
    return (product.customFields || []).some(isPricedPerChar);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isPricedPerChar, normalizeName, countChars, isValidName, fieldExtra, linePrice, minPrice, hasVariablePrice };
}
