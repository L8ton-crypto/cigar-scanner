/**
 * Seed a single retailer. Run like:
 * node scripts/seed-retailer.js "C.Gars Ltd" cgars-cigars.json https://www.cgarsltd.co.uk [--clear-all]
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/^[^:]+:\s*/i, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wa = a.split(' '), wb = b.split(' ');
  let m = 0;
  for (const w of wa) if (w.length >= 3 && wb.includes(w)) m++;
  return m / Math.max(wa.length, wb.length);
}

async function seed(retailerName, filename, retailerUrl) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) { console.log('File not found:', filename); return; }
  
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = raw.map((item, i) => ({
    name: item.name || '', brand: item.brand || '', price: parseFloat(item.price) || 0,
    url: item.url || '', imageUrl: item.image || item.imageUrl || item.image_url || '',
    format: item.format || '', available: item.available !== false && item.inStock !== false,
    sourceId: String(item.sourceId || item.source_id || item.wooId || `${retailerName.toLowerCase().replace(/\s+/g,'-')}-${i}`)
  })).filter(p => p.name && p.price > 0);
  
  console.log(`🏪 ${retailerName}: ${items.length} items from ${filename}\n`);
  
  // Clear existing prices for this retailer
  await sql`DELETE FROM cs_prices WHERE retailer = ${retailerName}`;
  console.log(`   Cleared existing ${retailerName} prices`);
  
  // Load existing products for matching
  const existing = await sql`SELECT id, name, brand FROM cs_products`;
  const normLookup = existing.map(p => ({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
  console.log(`   ${existing.length} existing products to match against\n`);
  
  let matched = 0, newProducts = 0, skipped = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const normName = normalise(item.name);
    if (!normName) { skipped++; continue; }
    
    let bestMatch = null, bestScore = 0;
    for (const ex of normLookup) {
      const score = matchScore(normName, ex.norm);
      if (score > bestScore) { bestScore = score; bestMatch = ex; }
    }
    
    let productId;
    if (bestScore >= 0.7 && bestMatch) {
      productId = bestMatch.id;
      matched++;
    } else {
      try {
        const result = await sql`
          INSERT INTO cs_products (name, brand, description, image_url, format, min_price, max_price, retailer_count, created_at)
          VALUES (${item.name}, ${item.brand}, ${''}, ${item.imageUrl}, ${item.format}, ${item.price}, ${item.price}, ${1}, ${new Date()})
          RETURNING id
        `;
        productId = result[0].id;
        newProducts++;
        normLookup.push({ id: productId, name: item.name, brand: item.brand, norm: normName });
      } catch (e) { skipped++; continue; }
    }
    
    try {
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${retailerName}, ${retailerUrl}, ${item.price}, ${'GBP'}, ${item.available}, ${item.url}, ${item.name}, ${item.sourceId}, ${new Date()})
      `;
    } catch (e) { /* skip */ }
    
    if ((i + 1) % 500 === 0) console.log(`   ${i + 1}/${items.length} (${newProducts} new, ${matched} matched)`);
  }
  
  console.log(`\n   ✅ ${newProducts} new products, ${matched} matched, ${skipped} skipped`);
  
  // Update aggregates
  await sql`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices WHERE retailer = ${retailerName}`;
  console.log(`   ${retailerName}: ${prices[0].c} prices in DB`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--clear-all')) {
    console.log('🗑️  Clearing ALL data...');
    await sql`DELETE FROM cs_prices`;
    await sql`DELETE FROM cs_products`;
    await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
    console.log('   Done.\n');
  }
  
  const retailerName = args.find(a => !a.startsWith('--') && !a.endsWith('.json') && !a.startsWith('http'));
  const filename = args.find(a => a.endsWith('.json'));
  const url = args.find(a => a.startsWith('http'));
  
  if (!retailerName || !filename || !url) {
    console.log('Usage: node seed-retailer.js "Retailer Name" data.json https://url [--clear-all]');
    return;
  }
  
  await seed(retailerName, filename, url);
}

main().catch(console.error);
