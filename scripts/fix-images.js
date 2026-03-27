/**
 * Fix missing images by:
 * 1. Cross-referencing from other retailers that have images for matched products
 * 2. Checking source data for image URLs that weren't captured
 */
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }

async function main() {
  let sql = getDb();
  
  // Check image coverage by retailer
  console.log('📸 Image coverage analysis:\n');
  
  const noImg = await sql`
    SELECT p.id, p.name, p.image_url
    FROM cs_products p
    WHERE p.image_url IS NULL OR p.image_url = ''
    ORDER BY p.id
  `;
  console.log(`Products missing images: ${noImg.length}\n`);
  
  // For products missing images, check if any retailer price has a product URL we can use
  // First, let's check which source files have image data
  const files = [
    { file: 'cgars-cigars.json', name: 'C.Gars Ltd' },
    { file: 'gq-tobaccos-cigars.json', name: 'GQ Tobaccos' },
    { file: 'havana-house-cigars.json', name: 'Havana House' },
    { file: 'house-of-cigars-data.json', name: 'House of Cigars' },
    { file: 'rebellion-data.json', name: 'Rebellion' },
    { file: 'sautter-data.json', name: 'Sautter' },
    { file: 'smoke-king-cigars.json', name: 'Smoke King' },
  ];
  
  // Build a lookup: normalised name → image URL from source data
  const imageMap = new Map();
  
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
  
  for (const f of files) {
    const filePath = path.join(__dirname, '..', f.file);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let withImg = 0;
    for (const item of data) {
      const img = item.image || item.imageUrl || item.image_url || '';
      if (img && img.length > 5) {
        const norm = normalise(item.name);
        if (!imageMap.has(norm)) {
          imageMap.set(norm, img);
          withImg++;
        }
      }
    }
    console.log(`   ${f.name}: ${withImg} images available`);
  }
  
  console.log(`\n📦 Total unique images in source data: ${imageMap.size}`);
  
  // Now try to match products missing images
  let fixed = 0;
  let stillMissing = 0;
  
  for (const product of noImg) {
    const norm = normalise(product.name);
    const img = imageMap.get(norm);
    
    if (img) {
      sql = getDb();
      await sql`UPDATE cs_products SET image_url = ${img} WHERE id = ${product.id}`;
      fixed++;
    } else {
      stillMissing++;
    }
    
    if ((fixed + stillMissing) % 200 === 0) {
      console.log(`   Processed ${fixed + stillMissing}/${noImg.length} (fixed: ${fixed})`);
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Still missing: ${stillMissing}`);
  
  // Final stats
  sql = getDb();
  const finalNoImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const finalWithImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\n📊 Final: ${finalWithImg[0].c} with images, ${finalNoImg[0].c} without`);
  
  // Show sample of products still missing images
  if (stillMissing > 0) {
    sql = getDb();
    const samples = await sql`
      SELECT p.name, pr.retailer 
      FROM cs_products p
      JOIN cs_prices pr ON p.id = pr.product_id
      WHERE p.image_url IS NULL OR p.image_url = ''
      LIMIT 10
    `;
    console.log('\n📋 Sample products still missing images:');
    samples.forEach(s => console.log(`   [${s.retailer}] ${s.name}`));
  }
}

main().catch(console.error);
