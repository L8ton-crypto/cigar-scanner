const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  const r = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  console.log('Prices by retailer:', JSON.stringify(r, null, 2));
  const p = await sql`SELECT COUNT(*) as total FROM cs_products`;
  console.log('Total products:', p[0].total);
}

check().catch(console.error);
