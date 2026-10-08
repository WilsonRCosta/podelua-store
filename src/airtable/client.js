const { airtable } = require('../config');

function tableUrl(table) {
  return new URL(`https://api.airtable.com/v0/${airtable.baseId}/${encodeURIComponent(table)}`);
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${airtable.token}`, ...extra };
}

// Fetches every record of a table, following Airtable's pagination.
// `params` are extra query params, e.g. { 'sort[0][field]': 'order' }.
// `label` is only used in error messages.
async function fetchAllRecords(table, { params = {}, label = table } = {}) {
  const records = [];
  let offset = null;
  do {
    const url = tableUrl(table);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Airtable (${label}) respondeu ${res.status}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function createRecord(table, fields) {
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable write to ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = { fetchAllRecords, createRecord };
