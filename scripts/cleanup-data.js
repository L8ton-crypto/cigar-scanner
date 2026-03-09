const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function cleanup() {
  console.log('🧹 Data cleanup\n');

  // 1. Remove duplicate price entries (same product, retailer, price)
  console.log('1. Removing duplicate prices...');
  const dupsRemoved = await sql`
    DELETE FROM cs_prices WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY product_id, retailer, price 
          ORDER BY id
        ) as rn
        FROM cs_prices
      ) ranked WHERE rn > 1
    )
  `;
  const afterDedup = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  console.log('   Prices after dedup:', afterDedup[0].c);

  // 2. Update min/max prices to only compare SINGLE prices (not boxes)
  // Singles are the fair comparison. Boxes are separate purchase options.
  console.log('\n2. Recalculating min/max from single prices only...');
  
  // First, tag which prices are "single" vs "bulk"
  // Singles: source_name contains "single", "1 single", or doesn't contain box/pack/bundle/cabinet/tin
  const products = await sql`SELECT id FROM cs_products`;
  let updated = 0;
  
  for (const p of products) {
    // Get single prices for this product
    const singlePrices = await sql`
      SELECT price FROM cs_prices 
      WHERE product_id = ${p.id}
        AND (
          LOWER(source_name) LIKE '%single%'
          OR LOWER(source_name) LIKE '%1 single%'
          OR (
            LOWER(source_name) NOT LIKE '%box of%'
            AND LOWER(source_name) NOT LIKE '%pack of%'
            AND LOWER(source_name) NOT LIKE '%bundle of%'
            AND LOWER(source_name) NOT LIKE '%cabinet of%'
            AND LOWER(source_name) NOT LIKE '%tin of%'
            AND LOWER(source_name) NOT LIKE '%twist of%'
          )
        )
      ORDER BY price ASC
    `;

    if (singlePrices.length > 0) {
      const min = Number(singlePrices[0].price);
      const max = Number(singlePrices[singlePrices.length - 1].price);
      await sql`UPDATE cs_products SET min_price = ${min}, max_price = ${max} WHERE id = ${p.id}`;
      updated++;
    }
    
    if (updated % 500 === 0 && updated > 0) console.log('   Updated', updated, '/', products.length);
  }
  console.log('   Updated', updated, 'products with single-only pricing');

  // 3. Recalculate retailer_count from actual distinct retailers in prices
  console.log('\n3. Recalculating retailer counts...');
  await sql`
    UPDATE cs_products p SET retailer_count = (
      SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id
    )
  `;

  // 4. Check for Zino Selection bloat
  console.log('\n4. Checking Zino Selection...');
  const zinoCount = await sql`SELECT COUNT(*) as c FROM cs_products WHERE brand = 'Zino Selection'`;
  const zinoSample = await sql`SELECT name FROM cs_products WHERE brand = 'Zino Selection' LIMIT 10`;
  console.log('   Zino products:', zinoCount[0].c);
  zinoSample.forEach(z => console.log('   -', z.name));

  // 5. Final stats
  console.log('\n📊 Final stats:');
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const prods = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count > 1`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  
  console.log('   Products:', prods[0].c);
  console.log('   Prices:', prices[0].c);
  console.log('   Multi-retailer:', multi[0].c);
  console.log('   With images:', withImg[0].c);
  
  // Show some sample savings now (should be reasonable)
  const topSavings = await sql`
    SELECT name, brand, min_price, max_price, retailer_count,
           (max_price - min_price) as savings
    FROM cs_products 
    WHERE retailer_count > 1 AND max_price > min_price
    ORDER BY savings DESC LIMIT 10
  `;
  console.log('\n🏆 Top savings (singles only):');
  topSavings.forEach(p => {
    console.log('   ' + p.brand + ' ' + p.name + ': £' + Number(p.min_price).toFixed(2) + '-£' + Number(p.max_price).toFixed(2) + ' (save £' + Number(p.savings).toFixed(2) + ', ' + p.retailer_count + ' retailers)');
  });
}

cleanup().catch(e => { console.error(e); process.exit(1); });
