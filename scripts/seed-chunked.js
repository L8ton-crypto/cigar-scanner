/**
 * Chunked seeder - processes items in batches with fresh DB connections.
 * Usage: node scripts/seed-chunked.js [--clear-all]
 * 
 * Processes all retailers in order, 500 items at a time,
 * with a fresh neon() connection per chunk to avoid timeouts.
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CHUNK_SIZE = 500;

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

function loadRetailer(filename) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function processChunk(items, retailerName, retailerUrl, normLookup) {
  const sql = getDb(); // Fresh connection per chunk
  let matched = 0, newProducts = 0, skipped = 0;
  
  for (const item of items) {
    const name = item.name || '';
    const price = parseFloat(item.price) || 0;
    if (!name || price <= 0) { skipped++; continue; }
    
    const normName = normalise(name);
    if (!normName) { skipped++; continue; }
    
    // Check if price already exists for this product+retailer (resume support)
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
          VALUES (${name}, ${item.brand || ''}, ${''}, ${item.image || item.imageUrl || item.image_url || ''},
                  ${item.format || ''}, ${price}, ${price}, ${1}, ${new Date()})
          RETURNING id
        `;
        productId = result[0].id;
        newProducts++;
        normLookup.push({ id: productId, name, brand: item.brand || '', norm: normName });
      } catch (e) { skipped++; continue; }
    }
    
    try {
      // Use ON CONFLICT to avoid duplicate prices
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${retailerName}, ${retailerUrl}, ${price}, ${'GBP'},
                ${item.available !== false && item.inStock !== false},
                ${item.url || ''}, ${name},
                ${String(item.sourceId || item.source_id || item.wooId || Math.random().toString(36).slice(2))},
                ${new Date()})
      `;
    } catch (e) { /* skip */ }
  }
  
  return { matched, newProducts, skipped };
}

async function main() {
  const clearAll = process.argv.includes('--clear-all');
  
  if (clearAll) {
    const sql = getDb();
    console.log('🗑️  Clearing ALL data...');
    await sql`DELETE FROM cs_prices`;
    await sql`DELETE FROM cs_products`;
    await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
    console.log('   Done.\n');
  }
  
  const retailers = [
    { file: 'cgars-cigars.json', name: 'C.Gars Ltd', url: 'https://www.cgarsltd.co.uk' },
    { file: 'gq-tobaccos-cigars.json', name: 'GQ Tobaccos', url: 'https://www.gqtobaccos.com' },
    { file: 'havana-house-cigars.json', name: 'Havana House', url: 'https://www.havanahouse.co.uk' },
    { file: 'house-of-cigars-data.json', name: 'House of Cigars', url: 'https://www.thehouseofcigars.co.uk' },
    { file: 'rebellion-data.json', name: 'Rebellion', url: 'https://www.rebellioncigars.co.uk' },
    { file: 'sautter-data.json', name: 'Sautter', url: 'https://www.sauttercigars.com' },
    { file: 'smoke-king-cigars.json', name: 'Smoke King', url: 'https://www.smokeking.co.uk' },
  ];
  
  // Load existing products for matching
  const sql = getDb();
  const existing = await sql`SELECT id, name, brand FROM cs_products`;
  const normLookup = existing.map(p => ({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
  console.log(`📦 ${existing.length} existing products\n`);
  
  for (const r of retailers) {
    const raw = loadRetailer(r.file);
    if (!raw.length) continue;
    
    // Clear any existing prices for this retailer (in case of partial previous run)
    const sqlCheck = getDb();
    const existingPrices = await sqlCheck`SELECT COUNT(*) as c FROM cs_prices WHERE retailer = ${r.name}`;
    if (parseInt(existingPrices[0].c) > 0) {
      console.log(`   Clearing ${existingPrices[0].c} existing ${r.name} prices...`);
      await sqlCheck`DELETE FROM cs_prices WHERE retailer = ${r.name}`;
    }
    
    console.log(`🏪 ${r.name}: ${raw.length} items`);
    
    let totalMatched = 0, totalNew = 0, totalSkipped = 0;
    
    // Process in chunks
    for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
      const chunk = raw.slice(i, i + CHUNK_SIZE);
      const result = await processChunk(chunk, r.name, r.url, normLookup);
      totalMatched += result.matched;
      totalNew += result.newProducts;
      totalSkipped += result.skipped;
      
      console.log(`   ${Math.min(i + CHUNK_SIZE, raw.length)}/${raw.length} (${totalNew} new, ${totalMatched} matched)`);
      
      // Brief pause between chunks to let connections reset
      await sleep(1000);
    }
    
    console.log(`   ✅ Done: ${totalNew} new, ${totalMatched} matched, ${totalSkipped} skipped\n`);
  }
  
  // Final update
  console.log('🔄 Updating aggregates...');
  const sqlFinal = getDb();
  await sqlFinal`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  const prodCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers2 = await sqlFinal`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  
  console.log(`\n📊 Final: ${prodCount[0].c} products, ${priceCount[0].c} prices`);
  retailers2.forEach(r => console.log(`   ${r.retailer}: ${r.c}`));
  
  const multi = await sqlFinal`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  console.log(`\n🔗 Products with 2+ retailers: ${multi[0].c}`);
}

main().catch(console.error);
