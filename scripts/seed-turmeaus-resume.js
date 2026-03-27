/**
 * Resume Turmeaus seeding from where it left off.
 * Does NOT clear existing data - only adds items not already in cs_prices for Turmeaus.
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CHUNK_SIZE = 300; // Smaller chunks for stability
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
  const words = ['humidor', 'cigar case', 'cutter', 'ashtray', 'lighter', 'punch',
    'travel case', 'finger case', 'cabinet', 'drawer', 'leather case',
    'gift set', 'sampler box', 'torch', 'holder', 'pouch', 'jar',
    'tube holder', 'cedar', 'hygrometer', 'humidifier', 'boveda',
    'matches', 'cigar stand', 'cigar rest', 'cigar box', 'cigar bag'];
  return words.some(w => lower.includes(w));
}

async function main() {
  console.log('🏪 Resuming Turmeaus seed\n');
  
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'turmeaus-data.json'), 'utf8'));
  const cigars = raw.filter(p => !isAccessory(p.name));
  
  // Deduplicate (same logic as original)
  const seen = new Map();
  for (const item of cigars) { if (!seen.has(item.name)) seen.set(item.name, item); }
  const normSeen = new Map();
  for (const item of seen.values()) {
    const norm = normalise(item.name);
    if (!norm) continue;
    if (!normSeen.has(norm) || item.price < normSeen.get(norm).price) normSeen.set(norm, item);
  }
  const deduped = Array.from(normSeen.values());
  console.log(`📄 Total deduped items: ${deduped.length}`);
  
  // Get existing Turmeaus source_names to skip
  const sql = getDb();
  const existingPrices = await sql`SELECT source_name FROM cs_prices WHERE retailer = ${RETAILER_NAME}`;
  const existingNames = new Set(existingPrices.map(p => p.source_name));
  console.log(`📦 Already seeded: ${existingNames.size} Turmeaus prices`);
  
  // Filter to only items not yet seeded
  const remaining = deduped.filter(item => !existingNames.has(item.name));
  console.log(`🔄 Remaining to seed: ${remaining.length}\n`);
  
  if (remaining.length === 0) {
    console.log('✅ All items already seeded!');
    return;
  }
  
  // Load existing products for matching
  const products = await sql`SELECT id, name, brand FROM cs_products`;
  const normLookup = products.map(p => ({ id: p.id, name: p.name, brand: p.brand, norm: normalise(p.name) }));
  
  let totalMatched = 0, totalNew = 0, totalSkipped = 0;
  
  for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
    const chunk = remaining.slice(i, i + CHUNK_SIZE);
    const chunkSql = getDb();
    
    for (const item of chunk) {
      const name = item.name || '';
      const price = parseFloat(item.price) || 0;
      if (!name || price <= 0) { totalSkipped++; continue; }
      
      const normName = normalise(name);
      if (!normName) { totalSkipped++; continue; }
      
      let bestMatch = null, bestScore = 0;
      for (const ex of normLookup) {
        const score = matchScore(normName, ex.norm);
        if (score > bestScore) { bestScore = score; bestMatch = ex; }
      }
      
      let productId;
      if (bestScore >= 0.7 && bestMatch) {
        productId = bestMatch.id;
        totalMatched++;
      } else {
        try {
          const result = await chunkSql`
            INSERT INTO cs_products (name, brand, description, image_url, format, min_price, max_price, retailer_count, created_at)
            VALUES (${name}, ${item.brand || ''}, ${''}, ${''}, ${item.format || ''}, ${price}, ${price}, ${1}, ${new Date()})
            RETURNING id
          `;
          productId = result[0].id;
          totalNew++;
          normLookup.push({ id: productId, name, brand: item.brand || '', norm: normName });
        } catch (e) { totalSkipped++; continue; }
      }
      
      try {
        await chunkSql`
          INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, source_id, scraped_at)
          VALUES (${productId}, ${RETAILER_NAME}, ${RETAILER_URL}, ${price}, ${'GBP'},
                  ${item.available !== false}, ${item.url || ''}, ${name},
                  ${'turmeaus-' + Math.random().toString(36).slice(2)}, ${new Date()})
        `;
      } catch (e) { /* skip */ }
    }
    
    console.log(`  ${Math.min(i + CHUNK_SIZE, remaining.length)}/${remaining.length} — ${totalNew} new, ${totalMatched} matched`);
    await sleep(2000); // Longer pause for stability
  }
  
  console.log(`\n📊 Resume Results: ${totalNew} new, ${totalMatched} matched, ${totalSkipped} skipped`);
  
  // Update aggregates
  console.log('🔄 Updating aggregates...');
  const sqlFinal = getDb();
  await sqlFinal`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  const prodCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sqlFinal`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers = await sqlFinal`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const multi = await sqlFinal`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  
  console.log(`\n✅ Final: ${prodCount[0].c} products, ${priceCount[0].c} prices, ${multi[0].c} multi-retailer`);
  retailers.forEach(r => console.log(`  ${r.retailer}: ${r.c}`));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
