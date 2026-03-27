const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  console.log('=== PASS 2: CLEANUP ===\n');

  // 1. Dedupe remaining prices
  console.log('Deduping remaining prices...');
  await sql`
    DELETE FROM cs_prices 
    WHERE id NOT IN (
      SELECT DISTINCT ON (product_id, retailer) id
      FROM cs_prices
      ORDER BY product_id, retailer, 
        (CASE WHEN price IS NOT NULL THEN 0 ELSE 1 END),
        scraped_at DESC NULLS LAST, 
        id DESC
    )`;

  // 2. Remove null prices
  console.log('Removing null prices...');
  await sql`DELETE FROM cs_prices WHERE price IS NULL`;

  // 3. Remove orphan products  
  console.log('Removing orphan products...');
  await sql`DELETE FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;

  // 4. Recalculate stats
  console.log('Recalculating stats...');
  await sql`
    UPDATE cs_products p SET 
      retailer_count = sub.cnt,
      min_price = sub.min_p,
      max_price = sub.max_p
    FROM (
      SELECT product_id, 
             count(DISTINCT retailer) as cnt,
             min(price) as min_p, 
             max(price) as max_p 
      FROM cs_prices 
      WHERE price IS NOT NULL
      GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id`;

  // Final counts
  console.log('\n=== FINAL STATE ===');
  const fp = await sql`SELECT count(*) as cnt FROM cs_products`;
  const fpr = await sql`SELECT count(*) as cnt FROM cs_prices`;
  console.log(`cs_products: ${fp[0].cnt}`);
  console.log(`cs_prices: ${fpr[0].cnt}`);

  // Verify clean
  const remDupes = await sql`
    SELECT count(*) as cnt FROM (
      SELECT product_id, retailer FROM cs_prices GROUP BY product_id, retailer HAVING count(*) > 1
    ) x`;
  const remNull = await sql`SELECT count(*) as cnt FROM cs_prices WHERE price IS NULL`;
  const remOrph = await sql`SELECT count(*) as cnt FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  
  console.log(`Duplicate prices: ${remDupes[0].cnt}`);
  console.log(`Null prices: ${remNull[0].cnt}`);
  console.log(`Orphan products: ${remOrph[0].cnt}`);

  // Retailer breakdown
  console.log('\nPrices by retailer:');
  const retailers = await sql`SELECT retailer, count(*) as cnt FROM cs_prices GROUP BY retailer ORDER BY cnt DESC`;
  retailers.forEach(r => console.log(`  ${r.retailer}: ${r.cnt}`));

  // Top comparison products (most retailers)
  console.log('\nTop products by retailer coverage:');
  const top = await sql`SELECT p.name, p.retailer_count, p.min_price, p.max_price FROM cs_products p ORDER BY p.retailer_count DESC LIMIT 10`;
  top.forEach(t => console.log(`  ${t.retailer_count} retailers | £${t.min_price}-£${t.max_price} | ${t.name}`));

  // Diplomaticos check
  console.log('\nDiplomaticos No.2 check:');
  const diplo = await sql`SELECT id, name, retailer_count, min_price, max_price FROM cs_products WHERE lower(name) LIKE '%diplomatico%no%2%'`;
  for (const d of diplo) {
    console.log(`  id=${d.id} "${d.name}" | ${d.retailer_count} retailers | £${d.min_price}-£${d.max_price}`);
    const prices = await sql`SELECT retailer, price, url, source_name FROM cs_prices WHERE product_id = ${d.id}`;
    prices.forEach(p => console.log(`    ${p.retailer}: £${p.price} ${p.source_name ? '('+p.source_name+')' : ''} ${p.url ? '✅' : '❌'}`));
  }

  console.log('\n✅ Pass 2 complete!');
})();
