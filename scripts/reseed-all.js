/**
 * Full reseed of cs_products + cs_prices from all JSON data files.
 * Drops and recreates all data. This is the nuclear option.
 * 
 * Source files:
 * - cgars-cigars.json (C.Gars Ltd)
 * - gq-tobaccos-cigars.json (GQ Tobaccos)
 * - havana-house-cigars.json (Havana House)
 * - house-of-cigars-data.json (House of Cigars)
 * - rebellion-data.json (Rebellion)
 * - sautter-data.json (Sautter)
 * - smoke-king-cigars.json (Smoke King)
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

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
    .replace(/^[^:]+:\s*/i, '') // Remove brand prefix before colon (Rebellion style)
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

// Each data file has slightly different shapes. Normalise them all.
function loadRetailer(filename, retailerName, retailerUrl) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️ ${filename} not found, skipping`);
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  return raw.map((item, i) => {
    // Detect format: old style (from seed.js) vs new style (from scraper)
    const name = item.name || '';
    const brand = item.brand || '';
    const price = parseFloat(item.price) || 0;
    const url = item.url || '';
    const imageUrl = item.image || item.imageUrl || item.image_url || '';
    const format = item.format || '';
    const available = item.available !== false && item.inStock !== false;
    const sourceId = item.sourceId || item.source_id || item.wooId || `${retailerName.toLowerCase().replace(/\s+/g,'-')}-${i}`;
    
    return {
      name, brand, price, url, imageUrl, format, available,
      retailer: retailerName,
      retailerUrl: retailerUrl,
      sourceId: String(sourceId)
    };
  }).filter(p => p.name && p.price > 0);
}

async function reseedAll() {
  console.log('🔄 Full Reseed — All Retailers');
  console.log('===============================\n');
  
  // Step 1: Clear everything
  console.log('🗑️  Clearing existing data...');
  await sql`DELETE FROM cs_prices`;
  await sql`DELETE FROM cs_products`;
  await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
  await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
  console.log('   Done.\n');
  
  // Step 2: Load all retailer data
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
  
  const allItems = [];
  for (const r of retailers) {
    const items = loadRetailer(r.file, r.name, r.url);
    console.log(`📦 ${r.name}: ${items.length} products`);
    allItems.push(...items);
  }
  console.log(`\n📊 Total items to process: ${allItems.length}\n`);
  
  // Step 3: Process each item - match or create product, then add price
  const normLookup = []; // { id, name, brand, norm }
  let matched = 0;
  let newProducts = 0;
  let skipped = 0;
  const retailerCounts = {};
  
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const normName = normalise(item.name);
    
    if (!normName) { skipped++; continue; }
    
    // Find best match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const ex of normLookup) {
      const score = matchScore(normName, ex.norm);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ex;
      }
    }
    
    let productId;
    
    if (bestScore >= 0.7 && bestMatch) {
      productId = bestMatch.id;
      matched++;
    } else {
      // Create new canonical product
      const result = await sql`
        INSERT INTO cs_products (
          name, brand, description, image_url, format,
          min_price, max_price, retailer_count, created_at
        ) VALUES (
          ${item.name}, ${item.brand}, ${''},
          ${item.imageUrl}, ${item.format},
          ${item.price}, ${item.price}, ${1},
          ${new Date()}
        ) RETURNING id
      `;
      productId = result[0].id;
      newProducts++;
      normLookup.push({ id: productId, name: item.name, brand: item.brand, norm: normName });
    }
    
    // Insert price
    await sql`
      INSERT INTO cs_prices (
        product_id, retailer, retailer_url, price, currency,
        available, url, source_name, source_id, scraped_at
      ) VALUES (
        ${productId}, ${item.retailer}, ${item.retailerUrl},
        ${item.price}, ${'GBP'},
        ${item.available}, ${item.url}, ${item.name}, ${item.sourceId},
        ${new Date()}
      )
    `;
    
    retailerCounts[item.retailer] = (retailerCounts[item.retailer] || 0) + 1;
    
    if ((i + 1) % 500 === 0) {
      console.log(`  ... ${i + 1}/${allItems.length} (${newProducts} products, ${matched} matches)`);
    }
  }
  
  // Step 4: Update aggregates
  console.log('\n🔄 Updating price ranges...');
  await sql`
    UPDATE cs_products SET
      min_price = sub.min_p,
      max_price = sub.max_p,
      retailer_count = sub.cnt
    FROM (
      SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt
      FROM cs_prices
      GROUP BY product_id
    ) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // Step 5: Report
  console.log(`\n📊 Final Results:`);
  console.log(`   Canonical products: ${newProducts}`);
  console.log(`   Matched prices: ${matched}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total prices: ${matched + newProducts}`);
  
  console.log('\n💰 Prices by retailer:');
  Object.entries(retailerCounts).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
    console.log(`   ${r}: ${c}`);
  });
  
  const prodCount = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  console.log(`\n📦 DB: ${prodCount[0].c} products, ${priceCount[0].c} prices`);
  
  // Multi-retailer examples
  const multi = await sql`
    SELECT name, min_price, max_price, retailer_count
    FROM cs_products
    WHERE retailer_count >= 3
    ORDER BY retailer_count DESC
    LIMIT 10
  `;
  if (multi.length) {
    console.log('\n🔍 Top multi-retailer products:');
    multi.forEach(r => console.log(`   ${r.name.substring(0, 50)}: £${r.min_price}-£${r.max_price} (${r.retailer_count} retailers)`));
  }
}

reseedAll().catch(console.error);
