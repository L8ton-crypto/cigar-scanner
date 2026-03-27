/**
 * Fix missing images by searching C.Gars and Turmeaus for each product.
 * C.Gars URLs are stale (-p.asp), so we search by name to find current pages.
 * Then extract image from the product page.
 */
const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const sql = getDb();
  
  const missing = await sql`
    SELECT p.id, p.name, p.brand, array_agg(DISTINCT pr.retailer) as retailers
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    GROUP BY p.id, p.name, p.brand
    ORDER BY p.brand, p.name
  `;
  
  console.log(`📸 ${missing.length} products need images\n`);
  
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  
  // Warmup C.Gars
  console.log('⏳ Warming up C.Gars...');
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  const title = await page.title();
  if (title.includes('Just a moment')) {
    console.log('⚠️ Cloudflare blocking - waiting longer...');
    await sleep(15000);
  }
  console.log('✅ Ready\n');
  
  let fixed = 0, failed = 0, skipped = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    
    // Clean search term: remove packaging info for better matches
    let searchName = product.name
      .replace(/\s*-\s*(Box|Cabinet|Pack|Bundle|Jar|Tin|Single|Sampler)\s+of\s+\d+.*/i, '')
      .replace(/\s*-\s*\d+\s*(Single|Cigars?|Packs?).*/i, '')
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheticals like (Discontinued)
      .replace(/FLASH SALE\s*-?\s*/i, '')
      .replace(/\d+\s*\+\s*\d+\s*/g, '')
      .trim();
    
    // If name is too short after cleaning, use original
    if (searchName.length < 8) searchName = product.name.split(' - ')[0].trim();
    
    const isCgars = product.retailers.includes('C.Gars Ltd');
    const isTurmeaus = product.retailers.includes('Turmeaus');
    
    try {
      let imgUrl = null;
      
      if (isCgars) {
        // Search C.Gars
        const searchUrl = `https://www.cgarsltd.co.uk/advanced_search_result.php?keywords=${encodeURIComponent(searchName)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(1500);
        
        // Check if we got results
        const hasResults = await page.evaluate(() => {
          return !document.body.textContent.includes('no products matched');
        });
        
        if (hasResults) {
          // Get first product link from search results
          const productUrl = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            for (const link of links) {
              if (link.href && link.href.match(/-p-\d+\.html$/)) return link.href;
            }
            return null;
          });
          
          if (productUrl) {
            // Navigate to product page
            await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await sleep(1000);
            
            // Extract image
            imgUrl = await page.evaluate(() => {
              const imgs = Array.from(document.querySelectorAll('img'));
              for (const img of imgs) {
                if (img.src && img.src.includes('/images/optimize/500x500_') && 
                    !img.src.includes('logo') && !img.src.includes('banner')) {
                  return img.src;
                }
              }
              for (const img of imgs) {
                if (img.src && img.src.includes('/images/') && img.alt && img.alt.length > 5 &&
                    !img.src.includes('logo') && !img.src.includes('banner') &&
                    !img.src.includes('badge') && !img.src.includes('design/')) {
                  return img.src;
                }
              }
              return null;
            });
          }
        }
      }
      
      // Turmeaus fallback (or primary for Turmeaus-only)
      if (!imgUrl && isTurmeaus) {
        // Try the Turmeaus product page directly via price URL
        const turmeausUrl = await sql`
          SELECT url FROM cs_prices WHERE product_id = ${product.id} AND retailer = 'Turmeaus' LIMIT 1
        `;
        if (turmeausUrl.length > 0 && turmeausUrl[0].url) {
          await page.goto(turmeausUrl[0].url, { waitUntil: 'domcontentloaded', timeout: 12000 });
          await sleep(1000);
          
          imgUrl = await page.evaluate(() => {
            // Turmeaus Zen Cart images
            const pureImg = document.querySelector('img.pure-img');
            if (pureImg && pureImg.src && pureImg.src.includes('/images/')) return pureImg.src;
            for (const img of document.querySelectorAll('img')) {
              if (img.src && img.src.includes('/images/thumbs/500x500')) return img.src;
            }
            for (const img of document.querySelectorAll('img')) {
              if (img.src && img.src.includes('/images/thumbs/200x200')) return img.src;
            }
            return null;
          });
        }
      }
      
      if (imgUrl && imgUrl.length > 10) {
        const db = getDb();
        await db`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        fixed++;
        console.log(`  ✅ [${i+1}/${missing.length}] ${product.brand || '?'} - ${product.name.substring(0, 50)}`);
      } else {
        failed++;
        console.log(`  ❌ [${i+1}/${missing.length}] ${product.brand || '?'} - ${product.name.substring(0, 50)}`);
      }
    } catch (e) {
      failed++;
      console.log(`  ⚠️ [${i+1}/${missing.length}] Error: ${e.message.substring(0, 60)}`);
    }
    
    await sleep(800 + Math.random() * 700); // Gentle rate limiting
  }
  
  await browser.close();
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  
  const db = getDb();
  const stats = await db`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_img
    FROM cs_products
  `;
  const pct = Math.round((stats[0].with_img / stats[0].total) * 100);
  console.log(`\n📊 ${stats[0].with_img}/${stats[0].total} with images (${pct}%)`);
  console.log(`   Still missing: ${stats[0].total - stats[0].with_img}`);
}

main().catch(console.error);
