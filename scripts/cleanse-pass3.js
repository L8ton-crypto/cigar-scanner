const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  console.log('=== PASS 3: AGGRESSIVE DUPE SWEEP ===\n');

  const allProducts = await sql`SELECT * FROM cs_products ORDER BY id`;
  
  function normalize(name) {
    return name
      .toLowerCase()
      .replace(/[''`´]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\(.*?\)/g, '')          // remove parenthetical text
      .replace(/\s+/g, ' ')
      .replace(/\bno\.\s*/g, 'no.')
      .replace(/\bno\s+(\d)/g, 'no.$1')
      .replace(/\s*[-–—]\s*/g, ' ')
      .replace(/\bcigars?\b/gi, '')
      .replace(/\btubed?\b/gi, '')
      .replace(/\btubo\b/gi, '')
      .replace(/\bsingle\b/gi, '')
      .replace(/\beach\b/gi, '')
      .replace(/\bper cigar\b/gi, '')
      .replace(/\bcuban\b/gi, '')
      .replace(/\bbox\s+of\s+\d+\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const groups = {};
  for (const p of allProducts) {
    const key = normalize(p.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const dupeGroups = Object.entries(groups).filter(([_, items]) => items.length > 1);
  console.log(`Found ${dupeGroups.length} remaining duplicate groups\n`);

  let mergedCount = 0;
  for (const [normName, items] of dupeGroups) {
    const canonical = items.sort((a, b) => {
      const aDesc = a.description ? 1 : 0;
      const bDesc = b.description ? 1 : 0;
      if (bDesc !== aDesc) return bDesc - aDesc;
      return a.id - b.id;
    })[0];

    const dupeIds = items.filter(i => i.id !== canonical.id).map(i => i.id);
    console.log(`  Merge "${normName}" -> keep id=${canonical.id} "${canonical.name}", drop ${dupeIds.join(', ')}`);

    for (const dupeId of dupeIds) {
      const dupeProduct = items.find(i => i.id === dupeId);
      if (dupeProduct && /tubed/i.test(dupeProduct.name)) {
        await sql`UPDATE cs_prices SET source_name = 'Tubed', product_id = ${canonical.id} WHERE product_id = ${dupeId}`;
      } else {
        await sql`UPDATE cs_prices SET product_id = ${canonical.id} WHERE product_id = ${dupeId}`;
      }
      await sql`DELETE FROM cs_products WHERE id = ${dupeId}`;
    }
    mergedCount += dupeIds.length;
  }
  console.log(`\nMerged ${mergedCount} more products`);

  // Dedupe prices again
  console.log('\nDeduping prices...');
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

  // Remove orphans
  await sql`DELETE FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;

  // Recalc stats
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
      FROM cs_prices WHERE price IS NOT NULL
      GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id`;

  // Final
  const fp = await sql`SELECT count(*) as cnt FROM cs_products`;
  const fpr = await sql`SELECT count(*) as cnt FROM cs_prices`;
  const remDupes = await sql`SELECT count(*) as cnt FROM (SELECT product_id, retailer FROM cs_prices GROUP BY product_id, retailer HAVING count(*) > 1) x`;
  
  console.log(`\n=== FINAL ===`);
  console.log(`cs_products: ${fp[0].cnt}`);
  console.log(`cs_prices: ${fpr[0].cnt}`);
  console.log(`Duplicate prices: ${remDupes[0].cnt}`);

  // Diplomaticos final check
  console.log('\nDiplomaticos No.2:');
  const diplo = await sql`SELECT id, name, retailer_count, min_price, max_price FROM cs_products WHERE lower(name) LIKE '%diplomatico%'`;
  for (const d of diplo) {
    const prices = await sql`SELECT retailer, price, source_name FROM cs_prices WHERE product_id = ${d.id}`;
    console.log(`  id=${d.id} "${d.name}" | ${d.retailer_count} retailers | £${d.min_price}-£${d.max_price}`);
    prices.forEach(p => console.log(`    ${p.retailer}: £${p.price} ${p.source_name ? '('+p.source_name+')' : ''}`));
  }

  console.log('\n✅ Pass 3 complete!');
})();
