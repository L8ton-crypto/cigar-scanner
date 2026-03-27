const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  if (DRY_RUN) console.log('🔍 DRY RUN — no changes will be made\n');
  else console.log('🔥 LIVE RUN — making changes\n');

  // ============================================================
  // STEP 1: Find and merge duplicate products
  // ============================================================
  console.log('=== STEP 1: MERGE DUPLICATE PRODUCTS ===');
  
  const allProducts = await sql`SELECT * FROM cs_products ORDER BY id`;
  
  function normalize(name) {
    return name
      .toLowerCase()
      .replace(/[''`´]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/\bno\.\s*/g, 'no.')
      .replace(/\bno\s+(\d)/g, 'no.$1')
      .replace(/\bnumber\s+(\d)/g, 'no.$1')
      .replace(/\s*[-–—]\s*/g, ' ')
      .replace(/\bcigars?\b/gi, '')
      .replace(/\btubed?\b/gi, '')
      .replace(/\btubo\b/gi, '')
      .replace(/\bsingle\b/gi, '')
      .replace(/\beach\b/gi, '')
      .replace(/\bper cigar\b/gi, '')
      .replace(/\bcuban\b/gi, '')
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
  console.log(`Found ${dupeGroups.length} duplicate groups`);

  let mergedCount = 0;

  for (const [normName, items] of dupeGroups) {
    const canonical = items.sort((a, b) => {
      const aDesc = a.description ? 1 : 0;
      const bDesc = b.description ? 1 : 0;
      if (bDesc !== aDesc) return bDesc - aDesc;
      const aBrand = (a.brand && a.brand.trim()) ? 1 : 0;
      const bBrand = (b.brand && b.brand.trim()) ? 1 : 0;
      if (bBrand !== aBrand) return bBrand - aBrand;
      const aImg = a.image_url ? 1 : 0;
      const bImg = b.image_url ? 1 : 0;
      if (bImg !== aImg) return bImg - aImg;
      return a.id - b.id;
    })[0];

    const dupeIds = items.filter(i => i.id !== canonical.id).map(i => i.id);

    if (!DRY_RUN) {
      for (const dupeId of dupeIds) {
        // Tag tubed variant prices so users can distinguish
        const dupeProduct = items.find(i => i.id === dupeId);
        if (dupeProduct && /tubed/i.test(dupeProduct.name)) {
          await sql`UPDATE cs_prices SET source_name = 'Tubed', product_id = ${canonical.id} WHERE product_id = ${dupeId}`;
        } else {
          await sql`UPDATE cs_prices SET product_id = ${canonical.id} WHERE product_id = ${dupeId}`;
        }
        await sql`DELETE FROM cs_products WHERE id = ${dupeId}`;
      }
    }
    mergedCount += dupeIds.length;
  }

  console.log(`Merged ${mergedCount} duplicate products\n`);

  // ============================================================
  // STEP 2: Dedupe prices using batch SQL (keep latest per product+retailer)
  // ============================================================
  console.log('=== STEP 2: DEDUPE PRICES ===');
  
  if (!DRY_RUN) {
    // Delete all but the best price per product+retailer combo
    // Best = has a price (not null), most recent scraped_at, highest id as tiebreak
    const deleted = await sql`
      DELETE FROM cs_prices 
      WHERE id NOT IN (
        SELECT DISTINCT ON (product_id, retailer) id
        FROM cs_prices
        ORDER BY product_id, retailer, 
          (CASE WHEN price IS NOT NULL THEN 0 ELSE 1 END),
          scraped_at DESC NULLS LAST, 
          id DESC
      )`;
    
    const remaining = await sql`SELECT count(*) as cnt FROM cs_prices`;
    console.log(`Prices after dedup: ${remaining[0].cnt}`);
  } else {
    const dupCount = await sql`
      SELECT count(*) as cnt FROM cs_prices 
      WHERE id NOT IN (
        SELECT DISTINCT ON (product_id, retailer) id
        FROM cs_prices
        ORDER BY product_id, retailer, 
          (CASE WHEN price IS NOT NULL THEN 0 ELSE 1 END),
          scraped_at DESC NULLS LAST, 
          id DESC
      )`;
    console.log(`Would remove ${dupCount[0].cnt} duplicate prices`);
  }
  console.log('');

  // ============================================================
  // STEP 3: Remove prices with NULL price
  // ============================================================
  console.log('=== STEP 3: REMOVE NULL PRICES ===');
  
  const nullCount = await sql`SELECT count(*) as cnt FROM cs_prices WHERE price IS NULL`;
  console.log(`Found ${nullCount[0].cnt} null prices`);
  
  if (!DRY_RUN) {
    await sql`DELETE FROM cs_prices WHERE price IS NULL`;
  }
  console.log('');

  // ============================================================
  // STEP 4: Remove products with no prices
  // ============================================================
  console.log('=== STEP 4: REMOVE EMPTY PRODUCTS ===');
  
  const orphanCount = await sql`
    SELECT count(*) as cnt FROM cs_products 
    WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  console.log(`Found ${orphanCount[0].cnt} products with no prices`);
  
  if (!DRY_RUN) {
    await sql`DELETE FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  }
  console.log('');

  // ============================================================
  // STEP 5: Recalculate retailer_count, min_price, max_price
  // ============================================================
  console.log('=== STEP 5: RECALCULATE STATS ===');
  
  if (!DRY_RUN) {
    const updated = await sql`
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
      WHERE p.id = sub.product_id
      RETURNING p.id`;
    console.log(`Updated stats for ${updated.length} products`);
  } else {
    console.log('Would recalculate all product stats');
  }
  console.log('');

  // ============================================================
  // STEP 6: Clean product names (remove "Cuban", "Single", "Tubed" suffixes, "Cigar - 1")
  // ============================================================
  console.log('=== STEP 6: CLEAN PRODUCT NAMES ===');
  
  if (!DRY_RUN) {
    const products = await sql`SELECT id, name FROM cs_products`;
    let namesCleaned = 0;
    
    for (const p of products) {
      let clean = p.name
        .replace(/\s+Cuban$/i, '')
        .replace(/\s+Tubed$/i, '')
        .replace(/\s+Single$/i, '')
        .replace(/\s+Tubed\s+Single$/i, '')
        .replace(/\s+Tubed\s+Cuban$/i, '')
        .replace(/\s*Cigar\s*-?\s*1\s*Single$/i, '')
        .replace(/\s+Cigars?$/i, '')
        .trim();
      
      if (clean !== p.name) {
        await sql`UPDATE cs_products SET name = ${clean} WHERE id = ${p.id}`;
        namesCleaned++;
      }
    }
    console.log(`Cleaned ${namesCleaned} product names`);
  } else {
    const messyNames = await sql`
      SELECT count(*) as cnt FROM cs_products 
      WHERE name ~ '(Cuban|Tubed|Single|Cigar.-.1)\\s*$'`;
    console.log(`Would clean ~${messyNames[0].cnt}+ product names`);
  }
  console.log('');

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('=== FINAL COUNTS ===');
  const fp = await sql`SELECT count(*) as cnt FROM cs_products`;
  const fpr = await sql`SELECT count(*) as cnt FROM cs_prices`;
  const fc = await sql`SELECT count(*) as cnt FROM cs_cigars`;
  console.log(`cs_products: ${fp[0].cnt}`);
  console.log(`cs_prices: ${fpr[0].cnt}`);
  console.log(`cs_cigars: ${fc[0].cnt} (legacy)`);
  
  // Verify
  const remDupes = await sql`
    SELECT count(*) as cnt FROM (
      SELECT product_id, retailer FROM cs_prices GROUP BY product_id, retailer HAVING count(*) > 1
    ) x`;
  const remNull = await sql`SELECT count(*) as cnt FROM cs_prices WHERE price IS NULL`;
  const remOrph = await sql`SELECT count(*) as cnt FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  
  console.log(`\nVerification:`);
  console.log(`  Duplicate prices remaining: ${remDupes[0].cnt}`);
  console.log(`  Null prices remaining: ${remNull[0].cnt}`);
  console.log(`  Orphan products remaining: ${remOrph[0].cnt}`);

  // URL coverage
  console.log(`\nURL Coverage:`);
  const urlStats = await sql`
    SELECT retailer, 
           count(*) as total,
           count(*) FILTER (WHERE url IS NOT NULL AND url != '') as with_url
    FROM cs_prices 
    GROUP BY retailer ORDER BY total DESC`;
  urlStats.forEach(r => console.log(`  ${r.retailer}: ${r.with_url}/${r.total} have URLs`));

  if (DRY_RUN) console.log('\n✅ Dry run complete. Run without --dry-run to apply.');
  else console.log('\n✅ CLEANSE COMPLETE!');
})();
