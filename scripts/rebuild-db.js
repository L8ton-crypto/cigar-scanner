const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function rebuild() {
  console.log('🗑️  Clearing all data...');
  
  // Delete in correct order (prices first due to FK)
  await sql`DELETE FROM cs_prices`;
  await sql`DELETE FROM cs_products`;
  
  // Reset sequences
  await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
  await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
  
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  
  console.log(`✅ Products: ${products[0].c}, Prices: ${prices[0].c}`);
  console.log('Database cleared. Ready for fresh seed.');
}

rebuild().catch(console.error);
