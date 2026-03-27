/**
 * Robust reseed - processes retailers one at a time with connection pooling.
 * Run each retailer separately to avoid connection limits.
 * Usage: node scripts/reseed-robust.js [retailer-name]
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

const RETAILERS = {
  'cgars': { file: 'cgars-cigars.json', name: 'C.Gars Ltd', url: 'https://www.cgarsltd.co.uk' },
  'gq': { file: 'gq-tobaccos-cigars.json', name: 'GQ Tobaccos', url: 'https://www.gqtobaccos.com' },
  'havana': { file: 'havana-house-cigars.json', name: 'Havana House', url: 'https://www.havanahouse.co.uk' },
  'house': { file: 'house-of-cigars-data.json', name: 'House of Cigars', url: 'https://www.thehouseofcigars.co.uk' },
  'rebellion': { file: 'rebellion-data.json', name: 'Rebellion', url: 'https://www.rebellioncigars.co.uk' },
  'sautter': { file: 'sautter-data.json', name: 'Sautter', url: 'https://www.sauttercigars.com' },
  'smokeking': { file: 'smoke-king-cigars.json', name: 'Smoke King', url: 'https://www.smokeking.co.uk' },
  'turmeaus': { file: 'turmeaus-data.json', name: 'Turmeaus', url: 'https://www.turmeaus.co.uk' },
};

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bbag of \d+/gi, '')
    .replace(/\bpack[s]? of \d+/gi, '').replace(/\b\d+ x packs?\b/gi, '').replace(/^[^:]+:\s*/i, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wordsA = a.split(' '), wordsB = b.split(' ');
  let matches = 0;
  for (const w of wordsA) if (w.length >= 3 && wordsB.includes(w)) matches++;
  return matches / Math.max(wordsA.length, wordsB.length);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const arg = process.argv[2];
  
  if (arg === 'clear') {
    console.log('🗑️ Clearing all data...');
    await sql`DELETE FROM cs_prices`;
    await sql`DELETE FROM cs_products`;
    await sql`ALTER SEQUENCE cs_products_id_seq RESTART WITH 1`;
    await sql`ALTER SEQUENCE cs_prices_id_seq RESTART WITH 1`;
    console.log('Done.');
    return;
  }
  
  if (arg === 'stats') {
    const p = await sql`SELECT count(*) as c FROM cs_products`;
    const pr = await sql`SELECT count(*) as c FROM cs_prices`;
    const r = await sql`SELECT retailer, count(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
    console.log(`Products: ${p[0].c}, Prices: ${pr[0].c}`);
    r.forEach(x => console.log(`  ${x.retailer}: ${x.c}`));
    
    const multi = await sql`SELECT name, retailer_count, min_price, max_price FROM cs_products WHERE retailer_count >= 3 ORDER BY retailer_count DESC LIMIT 5`;
    if (multi.length) {
      console.log('\nTop multi-retailer:');
      multi.forEach(m => console.log(`  ${m.name.substring(0, 50)}: ${m.retailer_count} retailers, £${m.min_price}-${m.max_price}`));
    }
    return;
  }
  
  if (arg === 'update') {
    console.log('🔄 Updating aggregates...');
    await sql`
      UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
      FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
      WHERE cs_products.id = sub.product_id`;
    console.log('Done.');
    return;
  }
  
  if (!arg || !RETAILERS[arg]) {
    console.log('Usage: node reseed-robust.js <command>');
    console.log('Commands: clear | stats | update | ' + Object.keys(RETAILERS).join(' | '));
    return;
  }
  
  const r = RETAILERS[arg];
  const filePath = path.join(__dirname, '..', r.file);
  if (!fs.existsSync(filePath)) { console.log(`File not found: ${r.file}`); return; }
  
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const items = raw.map((item, i) => ({
    name: item.name || '', brand: item.brand || '', price: parseFloat(item.price) || 0,
    url: item.url || '', imageUrl: item.image || item.imageUrl || item.image_url || '',
    format: item.format || '', available: item.available !== false,
    sourceId: String(item.sourceId || item.source_id || `${arg}-${i}`)
  })).filter(p => p.name && p.price > 0);
  
  console.log(`🏪 ${r.name}: ${items.length} items`);
  
  // Load existing products
  const existing = await sql`SELECT id, name, brand FROM cs_products`;
  const normLookup = existing.map(p => ({ id: p.id, norm: normalise(p.name) }));
  console.log(`📦 ${existing.length} existing products`);
  
  let matched = 0, created = 0, errors = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const normName = normalise(item.name);
    if (!normName) continue;
    
    // Find match
    let productId = null;
    for (const ex of normLookup) {
      if (matchScore(normName, ex.norm) >= 0.7) { productId = ex.id; matched++; break; }
    }
    
    // Create if no match
    if (!productId) {
      try {
        const res = await sql`
          INSERT INTO cs_products (name, brand, image_url, format, min_price, max_price, retailer_count, created_at)
          VALUES (${item.name}, ${item.brand}, ${item.imageUrl}, ${item.format}, ${item.price}, ${item.price}, 1, NOW())
          RETURNING id`;
        productId = res[0].id;
        normLookup.push({ id: productId, norm: normName });
        created++;
      } catch (e) { errors++; continue; }
    }
    
    // Insert price
    try {
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${r.name}, ${r.url}, ${item.price}, 'GBP', ${item.available}, ${item.url}, ${item.name}, ${item.sourceId}, NOW())`;
    } catch (e) { errors++; }
    
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${items.length} (${created} new, ${matched} matched, ${errors} errors)`);
      await sleep(500); // Longer pause every 100 items to avoid connection limits
    }
  }
  
  console.log(`✅ ${r.name}: ${created} new, ${matched} matched, ${errors} errors`);
}

run().catch(console.error);
