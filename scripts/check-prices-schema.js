const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Check cs_products columns
  console.log('=== cs_products schema ===');
  const prodCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cs_products' 
    ORDER BY ordinal_position
  `;
  console.log(prodCols);

  // Check cs_prices columns
  console.log('\n=== cs_prices schema ===');
  const priceCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cs_prices' 
    ORDER BY ordinal_position
  `;
  console.log(priceCols);

  // Check sample of big price gaps - WITH FILTER
  console.log('\n=== Top deals WITH filter (max 3x min) ===');
  const deals = await sql`
    SELECT p.name, p.brand, p.min_price, p.max_price, 
           (p.max_price - p.min_price) as gap,
           ROUND(((p.max_price - p.min_price) / p.max_price) * 100, 1) as savings_pct,
           p.retailer_count
    FROM cs_products p
    WHERE p.retailer_count > 1
      AND p.min_price IS NOT NULL
      AND p.max_price IS NOT NULL
      AND p.min_price > 0
      AND p.max_price > p.min_price
      AND p.max_price <= (p.min_price * 3)
    ORDER BY savings_pct DESC, gap DESC
    LIMIT 15
  `;
  console.log(deals);

  // Check if prices table has unit info
  console.log('\n=== Sample prices for top deal product ===');
  if (deals.length > 0) {
    const prices = await sql`
      SELECT pr.*, p.name 
      FROM cs_prices pr
      JOIN cs_products p ON pr.product_id = p.id
      WHERE p.name = ${deals[0].name} AND p.brand = ${deals[0].brand}
      ORDER BY pr.price
    `;
    console.log(prices);
  }
}

main().catch(console.error);
