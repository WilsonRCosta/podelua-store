require('dotenv').config();

const env = process.env;

module.exports = {
  port: env.PORT || 3000,
  airtable: {
    baseId: env.AIRTABLE_BASE_ID,
    token: env.AIRTABLE_TOKEN,
    tables: {
      products: env.AIRTABLE_PRODUCTS_TABLE,
      custom: env.AIRTABLE_CUSTOM_TABLE,
      orders: env.AIRTABLE_ORDERS_TABLE,
      sizes: env.AIRTABLE_SIZES_TABLE,
      quotas: env.AIRTABLE_QUOTAS_TABLE,
    },
  },
  gmail: {
    user: env.GMAIL_USER,
    appPassword: env.GMAIL_APP_PASSWORD,
  },
  bank: {
    iban: env.BANK_IBAN,
    holder: env.BANK_HOLDER,
  },
  cacheTtlMs: 30 * 1000,
  maxQtyPerLine: 3,
};
