const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const retailers = await sql`SELECT DISTINCT retailer, COUNT(*) as cnt FROM cs_prices GROUP BY retailer ORDER BY cnt DESC`;
  console.log('Retailers:', JSON.stringify(retailers, null, 2));
  
  const products = await sql`SELECT COUNT(*) FROM cs_products`;
  console.log('Products:', products[0].count);
  
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='cs_products' ORDER BY ordinal_position`;
  console.log('cs_products schema:', JSON.stringify(cols, null, 2));
  
  const pcols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='cs_prices' ORDER BY ordinal_position`;
  console.log('cs_prices schema:', JSON.stringify(pcols, null, 2));
  
  // Check if cs_scrape_log exists
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'cs_%'`;
  console.log('CS tables:', tables.map(t => t.table_name));
  
  // Sample a product
  const sample = await sql`SELECT * FROM cs_products LIMIT 1`;
  console.log('Sample product:', JSON.stringify(sample[0], null, 2));
  
  const samplePrice = await sql`SELECT * FROM cs_prices LIMIT 3`;
  console.log('Sample prices:', JSON.stringify(samplePrice, null, 2));
}

main().catch(console.error);
