const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function fix() {
  console.log('🔍 Finding box prices masquerading as singles...\n');

  // Strategy: For each product with 2+ prices, if one price is 3x+ another
  // from the same or different retailer, it's almost certainly a box price.
  // Remove any price that's wildly out of range of the median.

  const products = await sql`
    SELECT p.id, p.name, p.brand 
    FROM cs_products p 
    WHERE p.retailer_count > 1
  `;

  let removed = 0;
  let flagged = 0;

  for (const prod of products) {
    const prices = await sql`
      SELECT id, retailer, price, source_name 
      FROM cs_prices WHERE product_id = ${prod.id}
      ORDER BY price ASC
    `;

    if (prices.length < 2) continue;

    const cheapest = Number(prices[0].price);
    
    // Remove any price that's more than 3x the cheapest
    // (a box of 10 would be ~10x, box of 25 ~25x, even pack of 3 ~3x)
    for (const p of prices) {
      const ratio = Number(p.price) / cheapest;
      if (ratio > 2.5) {
        // Double check: does the source_name suggest it's a box/pack?
        const name = (p.source_name || '').toLowerCase();
        const isExplicitBox = name.match(/box of|pack of|bundle of|cabinet of|tin of|twist of/);
        
        // Even if source_name doesn't say box, a 3x+ price diff means it is one
        console.log(`  ❌ ${prod.brand} ${prod.name}`);
        console.log(`     Cheapest: £${cheapest.toFixed(2)} | Removing: £${Number(p.price).toFixed(2)} (${ratio.toFixed(1)}x) from ${p.retailer}`);
        console.log(`     Source: "${p.source_name}"`);
        
        await sql`DELETE FROM cs_prices WHERE id = ${p.id}`;
        removed++;
      }
    }
  }

  console.log(`\n✅ Removed ${removed} box/bulk prices\n`);

  // Also check single-retailer products: if a CGars price seems way too high
  // compared to what other brands/products in similar range cost, flag it
  // Get all CGars prices where the product only has 1 price and it's > £200
  const suspiciousSingles = await sql`
    SELECT p.id, p.name, p.brand, pr.price, pr.source_name, pr.id as price_id
    FROM cs_products p 
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.retailer_count = 1
    AND pr.price > 200
    AND pr.retailer = 'C.Gars Ltd'
    AND (
      LOWER(pr.source_name) LIKE '%box of%'
      OR LOWER(pr.source_name) LIKE '%pack of%'
      OR LOWER(pr.source_name) LIKE '%cabinet of%'
      OR LOWER(pr.source_name) LIKE '%bundle of%'
    )
    ORDER BY pr.price DESC
    LIMIT 20
  `;
  
  if (suspiciousSingles.length > 0) {
    console.log('📋 Single-retailer entries that are explicitly box prices:');
    for (const s of suspiciousSingles) {
      console.log(`  ${s.brand} ${s.name}: £${Number(s.price).toFixed(2)} - "${s.source_name}"`);
    }
  }

  // Now recalculate min/max prices for affected products
  console.log('\n⬆️  Recalculating min/max prices...');
  await sql`
    UPDATE cs_products p SET 
      retailer_count = (SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id),
      min_price = COALESCE((SELECT MIN(price) FROM cs_prices WHERE product_id = p.id), p.min_price),
      max_price = COALESCE((SELECT MAX(price) FROM cs_prices WHERE product_id = p.id), p.max_price)
  `;

  // Show the top savings now
  const topSavings = await sql`
    SELECT name, brand, min_price, max_price, retailer_count
    FROM cs_products 
    WHERE retailer_count > 1 AND max_price > min_price
    ORDER BY (max_price - min_price) DESC LIMIT 15
  `;
  console.log('\n🏆 Top savings after cleanup:');
  topSavings.forEach(p => {
    const save = Number(p.max_price) - Number(p.min_price);
    console.log(`  ${p.brand} ${p.name}: £${Number(p.min_price).toFixed(2)}-£${Number(p.max_price).toFixed(2)} (save £${save.toFixed(2)}, ${p.retailer_count} retailers)`);
  });

  // Final stats
  const stats = await sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE retailer_count > 1) as multi FROM cs_products
  `;
  const priceCount = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  console.log(`\n📊 Final: ${stats[0].total} products, ${priceCount[0].c} prices, ${stats[0].multi} multi-retailer`);
}

fix().catch(e => { console.error(e); process.exit(1); });
