const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function clear() {
  await sql`DELETE FROM cs_prices`;
  await sql`DELETE FROM cs_products`;
  await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
  await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
  const p = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const pr = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  console.log('Products:', p[0].c, 'Prices:', pr[0].c);
}
clear().catch(console.error);
