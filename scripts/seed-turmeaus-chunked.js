/**
 * Seed Turmeaus data into the clean DB using chunked approach.
 * 1. Deduplicates source data (exact + normalised name)
 * 2. Filters out accessories
 * 3. Seeds in chunks of 500 with fresh DB connections
 * 4. Updates aggregate stats
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CHUNK_SIZE = 500;
const RETAILER_NAME = 'Turmeaus';
const RETAILER_URL = 'https://www.turmeaus.co.uk';

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '').replace(/\bcuban\b/gi, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wa = a.split(' '), wb = b.split(' ');
  let m = 0;
  for (const w of wa) if (w.length >= 3 && wb.includes(w)) m++;
  return m / Math.max(wa.length, wb.length);
}

function isAccessory(name) {
  const lower = name.toLowerCase();
  const accessoryWords = [
    'humidor', 'cigar case', 'cutter', 'ashtray', 'lighter', 'punch',
    'travel case', 'finger case', 'cabinet', 'drawer', 'leather case',
    'gift set', 'sampler box', 'torch', 'holder', 'pouch', 'jar',
    'tube holder', 'cedar', 'hygrometer', 'humidifier', 'boveda',
    'matches', 'cigar stand', 'cigar rest', 'cigar box', 'cigar bag'
  ];
  return accessoryWords.some(w => lower.includes(w));
}

function deduplicateData(data) {
  // Pass 1: exact name dedup
  const seen = new Map();
  for (const item of data) {
    const key = item.name;
    if (!seen.has(key) || (item.price && !seen.get(key).price)) {
      seen.set(key, item);
    }
  }
  console.log(`  Exact dedup: ${data.length} → ${seen.size}`);
  
  // Pass 2: normalised name dedup (keep lowest price)
  const normSeen = new Map();
  for (const item of seen.values()) {
    const norm = normalise(item.name);
    if (!norm) continue;
    if (!normSeen.has(norm) || (item.price < normSeen.get(norm).price)) {
      normSeen.set(norm, item);
    }
  }
  console.log(`  Normalised dedup: ${seen.size} → ${normSeen.size}`);
  
  return Array.from(normSeen.values());
}

async function processChunk(items, normLookup) {
  const sql = getDb();
  let matched = 0, newProducts = 0, skipped = 0;
  
  for (const item of items) {
    const name = item.name || '';
    const price = parseFloat(item.price) || 0;
    if (!name || price <= 0) { skipped++; continue; }
    
    const normName = normalise(name);
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
          VALUES (${name}, ${item.brand || ''}, ${''}, ${''}, ${item.format || ''}, ${price}, ${price}, ${1}, ${new Date()})
          RETURNING id
        `;
        productId = result[0].id;
        newProducts++;
        normLookup.push({ id: productId, name, brand: item.brand || '', norm: normName });
      } catch (e) { skipped++; continue; }
    }
    
    try {
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${RETAILER_NAME}, ${RETAILER_URL}, ${price}, ${'GBP'},
                ${item.available !== false}, ${item.url || ''}, ${name},
                ${'turmeaus-' + Math.random().toString(36).slice(2)}, ${new Date()})
      `;
    } catch (e) { /* skip duplicate */ }
  }
  
  return { matched, newProducts, skipped };
}

async function main() {
  console.log('🏪 Seeding Turmeaus data (chunked)\n');
  
  // Load and deduplicate source data
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'turmeaus-data.json'), 'utf8'));
  console.log(`📄 Raw data: ${raw.length} items`);
  
  // Filter accessories
  const cigars = raw.filter(p => !isAccessory(p.name));
  console.log(`🚬 After accessory filter: ${cigars.length}`);
  
  // Deduplicate
  const deduped = deduplicateData(cigars);
  console.log(`✅ Final items to seed: ${deduped.length}\n`);
  
  // Clear existing Turmeaus data
  const sql = getDb();
  const existing = await sql`SELECT COUNT(*) as c FROM cs_prices WHERE retailer = ${RETAILER_NAME}`;
  if (parseInt(existing[0].c) > 0) {
    console.log(`🗑️  Clearing ${existing[0].c} existing Turmeaus prices...`);
    await sql`DELETE FROM cs_prices WHERE retailer = ${RETAILER_NAME}`;
  }
  
  // Load existing products for matching
  const products = await sql`SELECT id, name, brand FROM cs_products`;
  const normLookup = products.map(p => ({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
  console.log(`📦 ${products.length} existing products to match against\n`);
  
  // Process in chunks
  let totalMatched = 0, totalNew = 0, totalSkipped = 0;
  
  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE);
    const result = await processChunk(chunk, normLookup);
    totalMatched += result.matched;
    totalNew += result.newProducts;
    totalSkipped += result.skipped;
    
    console.log(`  ${Math.min(i + CHUNK_SIZE, deduped.length)}/${deduped.length} — ${result.newProducts} new, ${result.matched} matched`);
    await sleep(1500);
  }
  
  console.log(`\n📊 Seed Results:`);
  console.log(`   Matched existing: ${totalMatched}`);
  console.log(`   New products: ${totalNew}`);
  console.log(`   Skipped: ${totalSkipped}`);
  
  // Update aggregates
  console.log('\n🔄 Updating price aggregates...');
  const sqlFinal = getDb();
  await sqlFinal`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // Final stats
  const prodCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers = await sqlFinal`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const multi = await sqlFinal`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  
  console.log(`\n✅ Final DB State:`);
  console.log(`   Products: ${prodCount[0].c}`);
  console.log(`   Prices: ${priceCount[0].c}`);
  console.log(`   Multi-retailer: ${multi[0].c}`);
  console.log('   Retailers:');
  retailers.forEach(r => console.log(`     ${r.retailer}: ${r.c}`));
}

main().catch(console.error);
