const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  // Find duplicate prices (same product_id + retailer)
  const dupes = await sql`
    SELECT product_id, retailer, COUNT(*) as cnt
    FROM cs_prices
    GROUP BY product_id, retailer
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `;
  console.log('Duplicate prices:', dupes.length);
  dupes.slice(0, 5).forEach(d => console.log(`  product ${d.product_id} @ ${d.retailer}: ${d.cnt}x`));
  
  // Total dupe entries
  const totalDupes = await sql`
    SELECT SUM(cnt - 1) as extra FROM (
      SELECT product_id, retailer, COUNT(*) as cnt
      FROM cs_prices
      GROUP BY product_id, retailer
      HAVING COUNT(*) > 1
    ) sub
  `;
  console.log('Total extra entries:', totalDupes[0].extra);
}

check().catch(console.error);
