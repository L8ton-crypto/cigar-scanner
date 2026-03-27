/**
 * Scrape images for C.Gars products that are missing them.
 * Fetches product pages and extracts the main product image.
 * Processes in chunks to avoid connection issues.
 */
const https = require('https');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : require('http');
    const req = mod.get(url, {
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

function extractImage(html, retailer) {
  if (!html) return null;
  
  // C.Gars: look for main product image
  // Pattern: <img ... class="product-image" ... src="...">
  // Or: <meta property="og:image" content="...">
  let match;
  
  // Try og:image first (most reliable)
  match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
          html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  if (match) return match[1];
  
  // Try main product image
  match = html.match(/<img[^>]+class="[^"]*product[_-]?image[^"]*"[^>]+src="([^"]+)"/i);
  if (match) return match[1];
  
  // Try first large image in product area
  match = html.match(/id="product[_-]?image"[^>]*src="([^"]+)"/i);
  if (match) return match[1];
  
  // Try any img with the product name in alt text
  match = html.match(/<img[^>]+src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp))"[^>]+alt="[^"]*cigar/i);
  if (match) return match[1];
  
  return null;
}

async function main() {
  let sql = getDb();
  
  // Get products missing images that have C.Gars prices with URLs
  const missing = await sql`
    SELECT DISTINCT p.id, p.name, pr.url as product_url
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.url IS NOT NULL AND pr.url != ''
    AND pr.retailer = 'C.Gars Ltd'
    ORDER BY p.id
  `;
  
  console.log(`📸 ${missing.length} C.Gars products missing images\n`);
  
  let fixed = 0, failed = 0;
  const CHUNK = 50;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    
    try {
      const html = await fetchPage(product.product_url);
      const imgUrl = extractImage(html, 'C.Gars Ltd');
      
      if (imgUrl) {
        sql = getDb();
        await sql`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        fixed++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`   ${i + 1}/${missing.length} (fixed: ${fixed}, failed: ${failed})`);
      await sleep(500); // Be polite
    } else {
      await sleep(200);
    }
  }
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  
  // Final stats
  sql = getDb();
  const finalNoImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const finalWithImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log(`\n📊 Final: ${finalWithImg[0].c} with images, ${finalNoImg[0].c} without`);
}

main().catch(console.error);
