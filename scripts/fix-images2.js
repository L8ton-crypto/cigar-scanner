/**
 * Fix images v2 - more aggressive matching + try other retailer product pages
 * For products still missing images, try fuzzy matching against ALL source data
 */
const { neon } = require('@neondatabase/serverless');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—-]/g, ' ').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '').replace(/\bcuban\b/gi, '')
    .replace(/\b1\b/g, '').replace(/\bems\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '').replace(/\bbundle of \d+/gi, '').replace(/\btubed?\b/gi, '')
    .replace(/\b\(.*?\)/g, '').replace(/no\s*\.?\s*(\d)/g, 'no$1')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wa = a.split(' '), wb = b.split(' ');
  let m = 0;
  for (const w of wa) if (w.length >= 3 && wb.includes(w)) m++;
  return m / Math.max(wa.length, wb.length);
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  // Build comprehensive image lookup from ALL source files
  const files = [
    'cgars-cigars.json', 'gq-tobaccos-cigars.json', 'havana-house-cigars.json',
    'house-of-cigars-data.json', 'rebellion-data.json', 'sautter-data.json', 'smoke-king-cigars.json'
  ];
  
  const imageEntries = []; // { norm, img, words }
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
    for (const item of data) {
      const img = item.image || item.imageUrl || item.image_url || '';
      if (img && img.length > 5) {
        const norm = normalise(item.name);
        imageEntries.push({ norm, img, words: norm.split(' ') });
      }
    }
  }
  console.log(`📦 ${imageEntries.length} images from source data\n`);
  
  // Get products missing images
  let sql = getDb();
  const missing = await sql`
    SELECT id, name FROM cs_products 
    WHERE image_url IS NULL OR image_url = ''
    ORDER BY id
  `;
  console.log(`📸 ${missing.length} products missing images\n`);
  
  let fixed = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    const norm = normalise(product.name);
    
    // Try exact match first
    const exact = imageEntries.find(e => e.norm === norm);
    if (exact) {
      sql = getDb();
      await sql`UPDATE cs_products SET image_url = ${exact.img} WHERE id = ${product.id}`;
      fixed++;
      continue;
    }
    
    // Try fuzzy match (0.6 threshold for images - more lenient)
    let bestImg = null, bestScore = 0;
    for (const entry of imageEntries) {
      const score = matchScore(norm, entry.norm);
      if (score > bestScore) { bestScore = score; bestImg = entry.img; }
    }
    
    if (bestScore >= 0.6 && bestImg) {
      sql = getDb();
      await sql`UPDATE cs_products SET image_url = ${bestImg} WHERE id = ${product.id}`;
      fixed++;
    }
    
    if ((i + 1) % 200 === 0) {
      console.log(`   ${i + 1}/${missing.length} (fixed: ${fixed})`);
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed}`);
  
  // For remaining products with GQ/Havana House/Smoke King URLs, try scraping their pages
  sql = getDb();
  const stillMissing = await sql`
    SELECT DISTINCT p.id, p.name, pr.url as product_url, pr.retailer
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.url IS NOT NULL AND pr.url != ''
    AND pr.retailer != 'C.Gars Ltd'
    ORDER BY p.id
    LIMIT 200
  `;
  
  console.log(`\n🌐 Trying to scrape ${stillMissing.length} product pages for images...`);
  let scraped = 0;
  
  for (const product of stillMissing) {
    try {
      const html = await fetchPage(product.product_url);
      if (!html) continue;
      
      // Try og:image
      let match = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i);
      const imgUrl = match ? (match[1] || match[2]) : null;
      
      if (imgUrl) {
        sql = getDb();
        await sql`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        scraped++;
      }
    } catch (e) { /* skip */ }
    
    await sleep(300);
    if ((scraped) % 20 === 0 && scraped > 0) console.log(`   Scraped ${scraped} images`);
  }
  
  console.log(`   Scraped: ${scraped}`);
  
  // Final stats
  sql = getDb();
  const finalNoImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const finalWithImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\n📊 Final: ${finalWithImg[0].c} with images, ${finalNoImg[0].c} without`);
}

main().catch(console.error);
