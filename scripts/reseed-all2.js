/**
 * Full reseed v2 — processes one retailer at a time with batched inserts.
 * Run with: node scripts/reseed-all2.js [--skip-clear] [--start-from <retailer>]
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

const BATCH_SIZE = 50; // Insert this many prices per batch query

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&#\d+;/g, '')
    .replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\bcigar[s]?\b/gi, '')
    .replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '')
    .replace(/\bbox of \d+/gi, '')
    .replace(/\bbag of \d+/gi, '')
    .replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '')
    .replace(/^[^:]+:\s*/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wordsA = a.split(' ');
  const wordsB = b.split(' ');
  let matches = 0;
  for (const w of wordsA) {
    if (w.length >= 3 && wordsB.includes(w)) matches++;
  }
  return matches / Math.max(wordsA.length, wordsB.length);
}

function loadRetailer(filename, retailerName, retailerUrl) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  return raw.map((item, i) => ({
    name: item.name || '',
    brand: item.brand || '',
    price: parseFloat(item.price) || 0,
    url: item.url || '',
    imageUrl: item.image || item.imageUrl || item.image_url || '',
    format: item.format || '',
    available: item.available !== false && item.inStock !== false,
    retailer: retailerName,
    retailerUrl,
    sourceId: String(item.sourceId || item.source_id || item.wooId || `${retailerName.toLowerCase().replace(/\s+/g,'-')}-${i}`)
  })).filter(p => p.name && p.price > 0);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processRetailer(items, normLookup) {
  let matched = 0, newProducts = 0, skipped = 0;
  const retailerName = items[0]?.retailer || 'Unknown';
  
  // Process items and collect prices to batch-insert
  const priceBatch = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const normName = normalise(item.name);
    if (!normName) { skipped++; continue; }
    
    // Find best match
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
      } catch (e) {
        console.log(`    ⚠️ Product insert failed: ${e.message.substring(0, 80)}`);
        skipped++;
        continue;
      }
    }
    
    priceBatch.push({ productId, item });
    
    // Flush batch
    if (priceBatch.length >= BATCH_SIZE) {
      await flushPrices(priceBatch);
      priceBatch.length = 0;
      await sleep(50); // Brief pause between batches
    }
    
    if ((i + 1) % 500 === 0) {
      console.log(`    ${i + 1}/${items.length} (${newProducts} new, ${matched} matched)`);
    }
  }
  
  // Flush remaining
  if (priceBatch.length > 0) {
    await flushPrices(priceBatch);
  }
  
  return { matched, newProducts, skipped };
}

async function flushPrices(batch) {
  // Insert prices one by one with error handling (Neon serverless doesn't support multi-value inserts well)
  for (const { productId, item } of batch) {
    try {
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${item.retailer}, ${item.retailerUrl}, ${item.price}, ${'GBP'}, ${item.available}, ${item.url}, ${item.name}, ${item.sourceId}, ${new Date()})
      `;
    } catch (e) {
      // Skip silently
    }
  }
}

async function reseedAll() {
  const skipClear = process.argv.includes('--skip-clear');
  const startFromIdx = process.argv.indexOf('--start-from');
  const startFrom = startFromIdx > -1 ? process.argv[startFromIdx + 1] : null;
  
  console.log('🔄 Full Reseed v2');
  console.log('=================\n');
  
  const retailers = [
    { file: 'cgars-cigars.json', name: 'C.Gars Ltd', url: 'https://www.cgarsltd.co.uk' },
    { file: 'gq-tobaccos-cigars.json', name: 'GQ Tobaccos', url: 'https://www.gqtobaccos.com' },
    { file: 'havana-house-cigars.json', name: 'Havana House', url: 'https://www.havanahouse.co.uk' },
    { file: 'house-of-cigars-data.json', name: 'House of Cigars', url: 'https://www.thehouseofcigars.co.uk' },
    { file: 'rebellion-data.json', name: 'Rebellion', url: 'https://www.rebellioncigars.co.uk' },
    { file: 'sautter-data.json', name: 'Sautter', url: 'https://www.sauttercigars.com' },
    { file: 'smoke-king-cigars.json', name: 'Smoke King', url: 'https://www.smokeking.co.uk' },
    { file: 'turmeaus-data.json', name: 'Turmeaus', url: 'https://www.turmeaus.co.uk' },
  ];
  
  if (!skipClear) {
    console.log('🗑️  Clearing all data...');
    await sql`DELETE FROM cs_prices`;
    await sql`DELETE FROM cs_products`;
    await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
    console.log('   Done.\n');
  }
  
  // Load existing products for matching (if --skip-clear or --start-from)
  const normLookup = [];
  if (skipClear || startFrom) {
    const existing = await sql`SELECT id, name, brand FROM cs_products`;
    existing.forEach(p => normLookup.push({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
    console.log(`📦 Loaded ${existing.length} existing products\n`);
  }
  
  let skipping = !!startFrom;
  
  for (const r of retailers) {
    if (skipping) {
      if (r.name === startFrom) skipping = false;
      else { console.log(`⏭️  Skipping ${r.name}`); continue; }
    }
    
    const items = loadRetailer(r.file, r.name, r.url);
    console.log(`\n🏪 ${r.name}: ${items.length} items`);
    
    const result = await processRetailer(items, normLookup);
    console.log(`   ✅ ${result.newProducts} new products, ${result.matched} matched, ${result.skipped} skipped`);
    
    // Brief pause between retailers
    await sleep(500);
  }
  
  // Update aggregates
  console.log('\n🔄 Updating price ranges...');
  await sql`
    UPDATE cs_products SET
      min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (
      SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt
      FROM cs_prices GROUP BY product_id
    ) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // Final stats
  const prodCount = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers2 = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  
  console.log(`\n📊 Final: ${prodCount[0].c} products, ${priceCount[0].c} prices`);
  console.log('\n💰 By retailer:');
  retailers2.forEach(r => console.log(`   ${r.retailer}: ${r.c}`));
  
  const multi = await sql`
    SELECT name, min_price, max_price, retailer_count FROM cs_products
    WHERE retailer_count >= 3 ORDER BY retailer_count DESC LIMIT 5
  `;
  if (multi.length) {
    console.log('\n🔍 Top multi-retailer:');
    multi.forEach(r => console.log(`   ${r.name.substring(0, 50)}: £${r.min_price}-£${r.max_price} (${r.retailer_count})`));
  }
}

reseedAll().catch(console.error);
