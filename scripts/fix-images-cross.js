/**
 * Fix missing images by cross-referencing from other retailers' source data files.
 * For each product missing an image, find any price from a retailer that has images in their source data.
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const CHUNK_SIZE = 200;
function getDb() { return neon(process.env.DATABASE_URL); }

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—-]/g, ' ').replace(/[''""]/g, '')
    .replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '').replace(/\bcuban\b/gi, '')
    .replace(/\btubed?\b/gi, '').replace(/\b1\b/g, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wa = a.split(' '), wb = b.split(' ');
  let m = 0;
  for (const w of wa) if (w.length >= 3 && wb.includes(w)) m++;
  return m / Math.max(wa.length, wb.length);
}

function loadSourceImages() {
  // Load all source data files that have image URLs
  const sources = [
    { file: 'gq-tobaccos-cigars.json', field: 'image' },
    { file: 'havana-house-cigars.json', field: 'image' },
    { file: 'smoke-king-cigars.json', field: 'image' },
    { file: 'house-of-cigars-data.json', field: 'image' },
    { file: 'rebellion-data.json', field: 'imageUrl' },
    { file: 'sautter-data.json', field: 'image' },
  ];
  
  const allImages = [];
  for (const src of sources) {
    const filePath = path.join(__dirname, '..', src.file);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const item of data) {
      const imgUrl = item[src.field] || item.image || item.imageUrl || item.image_url;
      if (imgUrl && imgUrl.length > 10) {
        allImages.push({ name: item.name, norm: normalise(item.name || ''), image: imgUrl });
      }
    }
  }
  console.log(`📸 Loaded ${allImages.length} items with images from source data\n`);
  return allImages;
}

async function main() {
  let sql = getDb();
  
  const missing = await sql`SELECT id, name FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  console.log(`🖼️  ${missing.length} products missing images\n`);
  
  if (missing.length === 0) { console.log('✅ All products have images!'); return; }
  
  const sourceImages = loadSourceImages();
  
  let fixed = 0;
  
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const chunk = missing.slice(i, i + CHUNK_SIZE);
    const chunkSql = getDb();
    
    for (const product of chunk) {
      const normName = normalise(product.name);
      
      // Find best matching image from source data
      let bestImg = null, bestScore = 0;
      for (const src of sourceImages) {
        const score = matchScore(normName, src.norm);
        if (score > bestScore) { bestScore = score; bestImg = src; }
      }
      
      if (bestScore >= 0.6 && bestImg) {
        await chunkSql`UPDATE cs_products SET image_url = ${bestImg.image} WHERE id = ${product.id}`;
        fixed++;
      }
    }
    
    console.log(`  ${Math.min(i + CHUNK_SIZE, missing.length)}/${missing.length} — ${fixed} fixed`);
  }
  
  console.log(`\n✅ Fixed ${fixed}/${missing.length} via cross-reference`);
  
  // Check remaining
  sql = getDb();
  const stillMissing = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  console.log(`   Still missing: ${stillMissing[0].c}`);
}

main().catch(console.error);
