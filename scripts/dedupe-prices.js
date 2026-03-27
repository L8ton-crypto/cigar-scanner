const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function dedupe() {
  console.log('🧹 Deduplicating prices...');
  
  // Delete duplicate prices, keeping the one with the lowest id
  const result = await sql`
    DELETE FROM cs_prices
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM cs_prices
      GROUP BY product_id, retailer
    )
  `;
  
  console.log('Deleted duplicate prices');
  
  // Update aggregates
  console.log('Updating price ranges...');
  await sql`
    UPDATE cs_products SET
      min_price = sub.min_p,
      max_price = sub.max_p,
      retailer_count = sub.cnt
    FROM (
      SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt
      FROM cs_prices
      GROUP BY product_id
    ) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // Final stats
  const prices = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const totalPrices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  
  console.log(`\n📊 Final: ${products[0].c} products, ${totalPrices[0].c} prices`);
  console.log('\n💰 By retailer:');
  prices.forEach(r => console.log(`   ${r.retailer}: ${r.c}`));
  
  // Multi-retailer products
  const multi = await sql`
    SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2
  `;
  console.log(`\n🔗 Products with 2+ retailers: ${multi[0].c}`);
}

dedupe().catch(console.error);
