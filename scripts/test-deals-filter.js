const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('=== Filtered deals (max 3x ratio) ===\n');
  
  const deals = await sql`
    SELECT name, brand, min_price, max_price, 
           (max_price - min_price) as gap,
           ROUND(((max_price - min_price) / max_price) * 100, 1) as savings_pct,
           retailer_count
    FROM cs_products
    WHERE retailer_count > 1
      AND min_price IS NOT NULL
      AND max_price IS NOT NULL
      AND min_price > 0
      AND max_price > min_price
      AND max_price <= (min_price * 3)
    ORDER BY savings_pct DESC, gap DESC
    LIMIT 15
  `;
  
  deals.forEach((d, i) => {
    console.log(`${i+1}. ${d.brand} - ${d.name.substring(0, 50)}...`);
    console.log(`   £${d.min_price} - £${d.max_price} | Save £${d.gap} (${d.savings_pct}%) | ${d.retailer_count} retailers\n`);
  });

  const count = await sql`
    SELECT COUNT(*) as total FROM cs_products
    WHERE retailer_count > 1
      AND min_price IS NOT NULL
      AND max_price IS NOT NULL
      AND min_price > 0
      AND max_price > min_price
      AND max_price <= (min_price * 3)
  `;
  console.log(`\nTotal filtered deals: ${count[0].total}`);
}

main().catch(console.error);
