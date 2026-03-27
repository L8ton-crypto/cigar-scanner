/**
 * Fix missing images for Turmeaus products.
 * Turmeaus uses Zen Cart - no og:image, but product images are img.pure-img with 500x500 thumbs.
 * Also handles C.Gars products that lost images.
 */
const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let sql = getDb();
  
  const missing = await sql`
    SELECT DISTINCT ON (p.id) p.id, p.name, pr.url, pr.retailer
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.url IS NOT NULL AND pr.url != ''
    ORDER BY p.id, 
      CASE pr.retailer 
        WHEN 'Turmeaus' THEN 1
        WHEN 'C.Gars Ltd' THEN 2
        ELSE 3
      END
  `;
  
  console.log(`📸 ${missing.length} products need images\n`);
  
  const byRetailer = {};
  missing.forEach(m => { byRetailer[m.retailer] = (byRetailer[m.retailer] || 0) + 1; });
  Object.entries(byRetailer).sort((a,b) => b[1]-a[1]).forEach(([r, c]) => console.log(`   ${r}: ${c}`));
  console.log('');
  
  const browser = await chromium.launch({ headless: true });
  let ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  let page = await ctx.newPage();
  
  // For C.Gars: warm up Cloudflare
  const hasCgars = missing.some(m => m.retailer === 'C.Gars Ltd');
  if (hasCgars) {
    console.log('⏳ Cloudflare warmup for C.Gars...');
    try {
      await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(10000);
      const title = await page.title();
      console.log(title.includes('Just a moment') ? '⚠️ Cloudflare may block' : '✅ Cloudflare passed');
    } catch(e) { console.log('⚠️ Warmup failed'); }
    console.log('');
  }
  
  let fixed = 0, failed = 0;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    
    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await sleep(500);
      
      let imgUrl = null;
      
      if (product.retailer === 'Turmeaus') {
        // Turmeaus: Zen Cart - img.pure-img with 500x500 thumb, or first product image
        imgUrl = await page.evaluate(() => {
          // Primary: the large product image with pure-img class
          const pureImg = document.querySelector('img.pure-img');
          if (pureImg && pureImg.src && pureImg.src.includes('/images/')) {
            // Try to get full-size version
            const fullSrc = pureImg.src.replace('/thumbs/500x500_', '/').replace('/thumbs/200x200_', '/');
            return fullSrc;
          }
          // Fallback: any image in /images/thumbs/
          for (const img of document.querySelectorAll('img')) {
            if (img.src && img.src.includes('/images/thumbs/500x500')) return img.src;
          }
          for (const img of document.querySelectorAll('img')) {
            if (img.src && img.src.includes('/images/thumbs/200x200')) return img.src;
          }
          return null;
        });
      } else {
        // C.Gars and others: og:image or common selectors
        imgUrl = await page.evaluate(() => {
          const og = document.querySelector('meta[property="og:image"]');
          if (og && og.content && og.content.length > 10) return og.content;
          
          const selectors = ['#product-image img', '.product-image img', '.product-gallery img',
            '.main-image img', '[data-zoom-image]', '.woocommerce-product-gallery__image img'];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const src = el.getAttribute('data-zoom-image') || el.src;
              if (src && src.length > 10) return src;
            }
          }
          return null;
        });
      }
      
      if (imgUrl && imgUrl.length > 10 && !imgUrl.includes('logo') && !imgUrl.includes('icon')) {
        const chunkSql = getDb();
        await chunkSql`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        fixed++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`   ${i + 1}/${missing.length} (fixed: ${fixed}, failed: ${failed})`);
    }
    
    // Refresh context every 400
    if ((i + 1) % 400 === 0) {
      await page.close();
      await ctx.close();
      ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      page = await ctx.newPage();
      if (hasCgars) {
        try {
          await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(8000);
        } catch(e) {}
      }
    }
    
    await sleep(250 + Math.random() * 250);
  }
  
  await browser.close();
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  
  sql = getDb();
  const noImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const total = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const pct = Math.round(((parseInt(total[0].c) - parseInt(noImg[0].c)) / parseInt(total[0].c)) * 100);
  console.log(`\n📊 ${parseInt(total[0].c) - parseInt(noImg[0].c)}/${total[0].c} with images (${pct}%)`);
  console.log(`   Still missing: ${noImg[0].c}`);
}

main().catch(console.error);
