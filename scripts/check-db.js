const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function check() {
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  const noImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  console.log('Products:', products[0].c);
  console.log('Prices:', prices[0].c);
  console.log('Multi-retailer:', multi[0].c);
  console.log('No image:', noImg[0].c);
  console.log('Retailers:');
  retailers.forEach(r => console.log('  ' + r.retailer + ': ' + r.c));
}

check().catch(console.error);
