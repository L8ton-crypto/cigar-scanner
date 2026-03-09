const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function cleanup() {
  console.log('=== Final Cleanup ===\n');

  // 1. Remove Zino Selection products with no images (bespoke samplers)
  const zinoNoImg = await sql`
    SELECT id, name FROM cs_products 
    WHERE brand = 'Zino Selection' AND image_url IS NULL
  `;
  console.log(`1. Zino Selection samplers (no image): ${zinoNoImg.length}`);
  if (zinoNoImg.length > 0) {
    const zinoIds = zinoNoImg.map(z => z.id);
    await sql`DELETE FROM cs_prices WHERE product_id = ANY(${zinoIds})`;
    await sql`DELETE FROM cs_products WHERE id = ANY(${zinoIds})`;
    console.log(`   ✅ Deleted ${zinoNoImg.length} Zino samplers + their prices`);
  }

  // 2. Remove humidors/accessories (not cigars)
  const humidors = await sql`
    SELECT id, name, brand FROM cs_products 
    WHERE LOWER(name) LIKE '%humidor%' 
    OR LOWER(name) LIKE '%ashtray%'
    OR LOWER(name) LIKE '%lighter%'
    OR LOWER(name) LIKE '%cutter%'
    OR LOWER(name) LIKE '%travel case%'
    OR LOWER(name) LIKE '%cigar case%'
  `;
  console.log(`\n2. Humidors/accessories: ${humidors.length}`);
  humidors.forEach(h => console.log(`   ${h.name}`));
  if (humidors.length > 0) {
    const humIds = humidors.map(h => h.id);
    await sql`DELETE FROM cs_prices WHERE product_id = ANY(${humIds})`;
    await sql`DELETE FROM cs_products WHERE id = ANY(${humIds})`;
    console.log(`   ✅ Deleted ${humidors.length} non-cigar products`);
  }

  // 3. Clean GQ Tobaccos box prices (anything wildly above other retailers for same product)
  // Also catch single-retailer GQ prices that are clearly boxes
  const gqBoxPrices = await sql`
    SELECT pr.id, pr.price, pr.source_name, p.name, p.id as pid
    FROM cs_prices pr
    JOIN cs_products p ON p.id = pr.product_id
    WHERE pr.retailer = 'GQ Tobaccos'
    AND pr.price > 200
    AND (
      LOWER(pr.source_name) LIKE '%box of%'
      OR LOWER(pr.source_name) LIKE '%bundle of%'
      OR LOWER(pr.source_name) LIKE '%cabinet of%'
      OR LOWER(pr.source_name) LIKE '%pack of%'
      OR LOWER(pr.source_name) LIKE '%tin of%'
    )
  `;
  console.log(`\n3. GQ Tobaccos explicit box prices (>£200): ${gqBoxPrices.length}`);
  gqBoxPrices.slice(0, 10).forEach(p => console.log(`   £${Number(p.price).toFixed(2)} - ${p.source_name}`));
  if (gqBoxPrices.length > 10) console.log(`   ... and ${gqBoxPrices.length - 10} more`);
  if (gqBoxPrices.length > 0) {
    const gqIds = gqBoxPrices.map(p => p.id);
    await sql`DELETE FROM cs_prices WHERE id = ANY(${gqIds})`;
    console.log(`   ✅ Deleted ${gqBoxPrices.length} GQ box prices`);
  }

  // Also catch any remaining multi-retailer box prices (ratio > 2.5x cheapest)
  const multiProducts = await sql`
    SELECT p.id, p.name FROM cs_products p WHERE p.retailer_count > 1
  `;
  let boxRemoved = 0;
  for (const prod of multiProducts) {
    const prices = await sql`
      SELECT id, price, retailer FROM cs_prices WHERE product_id = ${prod.id} ORDER BY price ASC
    `;
    if (prices.length < 2) continue;
    const cheapest = Number(prices[0].price);
    for (const p of prices) {
      if (Number(p.price) / cheapest > 2.5) {
        await sql`DELETE FROM cs_prices WHERE id = ${p.id}`;
        boxRemoved++;
      }
    }
  }
  console.log(`\n4. Multi-retailer box prices (>2.5x cheapest): ${boxRemoved} removed`);

  // 5. Fix duplicates
  const dupes = await sql`
    SELECT LOWER(name) as lname, array_agg(id ORDER BY retailer_count DESC, id) as ids
    FROM cs_products GROUP BY LOWER(name) HAVING COUNT(*) > 1
  `;
  console.log(`\n5. Duplicates: ${dupes.length}`);
  for (const d of dupes) {
    const keepId = d.ids[0];
    const removeIds = d.ids.slice(1);
    // Move prices from dupes to the keeper
    for (const rid of removeIds) {
      await sql`UPDATE cs_prices SET product_id = ${keepId} WHERE product_id = ${rid}`;
      await sql`DELETE FROM cs_products WHERE id = ${rid}`;
    }
    console.log(`   Merged "${d.lname}" (kept #${keepId}, removed ${removeIds.join(', ')})`);
  }

  // 6. Remove orphaned products (no prices)
  const orphans = await sql`
    DELETE FROM cs_products p
    WHERE NOT EXISTS (SELECT 1 FROM cs_prices pr WHERE pr.product_id = p.id)
    RETURNING id, name
  `;
  console.log(`\n6. Orphaned products (no prices): ${orphans.length} removed`);

  // 7. Recalculate min/max/retailer_count for all products
  console.log('\n7. Recalculating product stats...');
  await sql`
    UPDATE cs_products p SET 
      retailer_count = COALESCE((SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id), 0),
      min_price = COALESCE((SELECT MIN(price) FROM cs_prices WHERE product_id = p.id), p.min_price),
      max_price = COALESCE((SELECT MAX(price) FROM cs_prices WHERE product_id = p.id), p.max_price)
  `;
  console.log('   ✅ Done');

  // Final stats
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count > 1`;
  const pct = Math.round(withImg[0].c / products[0].c * 100);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`📊 Final: ${products[0].c} products, ${prices[0].c} prices`);
  console.log(`📸 Images: ${withImg[0].c}/${products[0].c} (${pct}%)`);
  console.log(`🔄 Multi-retailer: ${multi[0].c}`);

  // Remaining high prices
  const stillHigh = await sql`
    SELECT p.name, pr.price, pr.retailer
    FROM cs_prices pr JOIN cs_products p ON p.id = pr.product_id
    WHERE pr.price > 500 ORDER BY pr.price DESC LIMIT 5
  `;
  console.log('\nHighest remaining prices:');
  stillHigh.forEach(h => console.log(`  £${Number(h.price).toFixed(2)} - ${h.name} (${h.retailer})`));
}

cleanup().catch(e => { console.error(e); process.exit(1); });
