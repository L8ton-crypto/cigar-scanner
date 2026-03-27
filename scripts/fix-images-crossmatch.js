/**
 * Cross-match missing images: for products without images,
 * check if any other retailer's price entry links to a product page
 * we can scrape, or check the source JSON files for image URLs.
 */
const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }

async function main() {
  const sql = getDb();
  
  // Get all products still missing images
  const missing = await sql`
    SELECT p.id, p.name, p.brand, array_agg(DISTINCT pr.retailer) as retailers,
           array_agg(DISTINCT pr.url) as urls
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    GROUP BY p.id, p.name, p.brand
  `;
  
  console.log(`📸 ${missing.length} products still missing images\n`);
  
  // Load all source JSONs that have images
  const sources = [
    { file: 'smoke-king-cigars.json', key: 'image', urlKey: 'url' },
    { file: 'havana-house-cigars.json', key: 'imageUrl', urlKey: 'url' },
    { file: 'house-of-cigars-data.json', key: 'imageUrl', urlKey: 'url' },
    { file: 'sautter-data.json', key: 'imageUrl', urlKey: 'url' },
    { file: 'gq-tobaccos-cigars.json', key: 'imageUrl', urlKey: 'url' },
    { file: 'rebellion-data.json', key: 'imageUrl', urlKey: 'url' },
    { file: 'turmeaus-data.json', key: 'imageUrl', urlKey: 'url' },
  ];
  
  // Build a lookup: normalize product name -> image URL
  const imageByUrl = {};
  const imageByName = {};
  
  for (const src of sources) {
    const filePath = path.join(__dirname, '..', src.file);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    for (const item of data) {
      const img = item[src.key];
      if (!img || img.length < 10) continue;
      if (item[src.urlKey]) imageByUrl[item[src.urlKey]] = img;
      // Normalize name for fuzzy matching
      const normName = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normName.length > 5) imageByName[normName] = img;
    }
  }
  
  console.log(`📦 Loaded ${Object.keys(imageByUrl).length} URL mappings, ${Object.keys(imageByName).length} name mappings\n`);
  
  let fixed = 0;
  
  for (const product of missing) {
    let imgUrl = null;
    
    // 1. Check by URL match
    for (const url of product.urls) {
      if (imageByUrl[url]) {
        imgUrl = imageByUrl[url];
        break;
      }
    }
    
    // 2. Check by name match
    if (!imgUrl) {
      const normName = product.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (imageByName[normName]) {
        imgUrl = imageByName[normName];
      }
    }
    
    // 3. Fuzzy: check if product name contains a source name or vice versa
    if (!imgUrl) {
      const normName = product.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      for (const [srcName, srcImg] of Object.entries(imageByName)) {
        // Both directions - either contains the other (but min 15 chars to avoid false matches)
        if (normName.length >= 15 && srcName.length >= 15) {
          if (normName.includes(srcName) || srcName.includes(normName)) {
            imgUrl = srcImg;
            break;
          }
        }
      }
    }
    
    if (imgUrl) {
      const db = getDb();
      await db`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
      fixed++;
      console.log(`  ✅ ${product.brand} - ${product.name}`);
    }
  }
  
  console.log(`\n✅ Cross-matched: ${fixed}`);
  console.log(`❌ Still missing: ${missing.length - fixed}`);
  
  // Show what's left
  if (missing.length - fixed > 0) {
    const stillMissing = await sql`
      SELECT p.id, p.name, p.brand, array_agg(DISTINCT pr.retailer) as retailers
      FROM cs_products p
      JOIN cs_prices pr ON p.id = pr.product_id
      WHERE (p.image_url IS NULL OR p.image_url = '')
      GROUP BY p.id, p.name, p.brand
      ORDER BY p.brand, p.name
      LIMIT 20
    `;
    console.log('\nRemaining:');
    stillMissing.forEach(s => console.log(`  ${s.brand || '?'} - ${s.name} [${s.retailers.join(', ')}]`));
  }
}

main().catch(console.error);
