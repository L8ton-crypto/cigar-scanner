const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '').replace(/^[^:]+:\s*/i, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wa = a.split(' '), wb = b.split(' ');
  let m = 0;
  for (const w of wa) if (w.length >= 3 && wb.includes(w)) m++;
  return m / Math.max(wa.length, wb.length);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1. Remove Turmeaus prices (not ready yet)
  console.log('🗑️  Removing Turmeaus prices...');
  let sql = getDb();
  await sql`DELETE FROM cs_prices WHERE retailer = 'Turmeaus'`;
  console.log('   Done.');
  
  // 2. Remove orphaned products (no prices left)
  console.log('🗑️  Removing orphaned products...');
  sql = getDb();
  await sql`DELETE FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  console.log('   Done.');
  
  // 3. Remove duplicate prices (same product_id + retailer)
  console.log('🧹  Removing duplicate prices...');
  sql = getDb();
  await sql`
    DELETE FROM cs_prices WHERE id NOT IN (
      SELECT MIN(id) FROM cs_prices GROUP BY product_id, retailer
    )
  `;
  console.log('   Done.');
  
  // 4. Check what Havana House items are missing and fill them
  console.log('\n📦 Checking Havana House completeness...');
  sql = getDb();
  const hhPrices = await sql`SELECT source_name FROM cs_prices WHERE retailer = 'Havana House'`;
  const hhExisting = new Set(hhPrices.map(p => normalise(p.source_name)));
  
  const hhData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'havana-house-cigars.json'), 'utf8'));
  const missing = hhData.filter(item => {
    const norm = normalise(item.name);
    return norm && !hhExisting.has(norm);
  });
  console.log(`   ${hhPrices.length} existing, ${missing.length} missing`);
  
  if (missing.length > 0) {
    // Load products for matching
    sql = getDb();
    const products = await sql`SELECT id, name, brand FROM cs_products`;
    const normLookup = products.map(p => ({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
    
    for (const item of missing) {
      const normName = normalise(item.name);
      let bestMatch = null, bestScore = 0;
      for (const ex of normLookup) {
        const score = matchScore(normName, ex.norm);
        if (score > bestScore) { bestScore = score; bestMatch = ex; }
      }
      
      let productId;
      sql = getDb();
      if (bestScore >= 0.7 && bestMatch) {
        productId = bestMatch.id;
      } else {
        try {
          const result = await sql`
            INSERT INTO cs_products (name, brand, description, image_url, format, min_price, max_price, retailer_count, created_at)
            VALUES (${item.name}, ${item.brand || ''}, ${''}, ${item.image || item.imageUrl || ''}, ${item.format || ''}, ${parseFloat(item.price)}, ${parseFloat(item.price)}, ${1}, ${new Date()})
            RETURNING id
          `;
          productId = result[0].id;
          normLookup.push({ id: productId, name: item.name, brand: item.brand || '', norm: normName });
        } catch (e) { continue; }
      }
      
      try {
        await sql`
          INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
          VALUES (${productId}, ${'Havana House'}, ${'https://www.havanahouse.co.uk'}, ${parseFloat(item.price)}, ${'GBP'}, ${true}, ${item.url || ''}, ${item.name}, ${item.sourceId || 'hh-fill'}, ${new Date()})
        `;
      } catch (e) { /* skip */ }
    }
    console.log(`   Filled ${missing.length} missing items`);
  }
  
  // 5. Update aggregates
  console.log('\n🔄 Updating aggregates...');
  sql = getDb();
  await sql`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // 6. Check images
  console.log('\n📸 Checking images...');
  sql = getDb();
  const noImage = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const withImage = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`   With images: ${withImage[0].c}`);
  console.log(`   Missing images: ${noImage[0].c}`);
  
  // 7. Final stats
  console.log('\n📊 Final stats:');
  sql = getDb();
  const prodCount = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  const dupes = await sql`SELECT COUNT(*) as c FROM (SELECT product_id, retailer, COUNT(*) as cnt FROM cs_prices GROUP BY product_id, retailer HAVING COUNT(*) > 1) sub`;
  
  console.log(`   Products: ${prodCount[0].c}`);
  console.log(`   Prices: ${priceCount[0].c}`);
  console.log(`   Multi-retailer: ${multi[0].c}`);
  console.log(`   Duplicate prices: ${dupes[0].c}`);
  retailers.forEach(r => console.log(`   ${r.retailer}: ${r.c}`));
  
  // 8. Check Diplomaticos specifically
  console.log('\n🔍 Diplomaticos No. 2 check:');
  sql = getDb();
  const diplo = await sql`SELECT id, name FROM cs_products WHERE name ILIKE '%diplomaticos%no%2%'`;
  for (const d of diplo) {
    const prices = await sql`SELECT retailer, price FROM cs_prices WHERE product_id = ${d.id}`;
    console.log(`   ID ${d.id}: "${d.name}" — ${prices.length} prices`);
    prices.forEach(p => console.log(`      ${p.retailer}: £${p.price}`));
  }
}

main().catch(console.error);
