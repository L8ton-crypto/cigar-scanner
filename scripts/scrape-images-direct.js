/**
 * Scrape images by visiting product URLs directly.
 * No name matching needed - we have the exact URL for each product.
 * Processes in batches, creates fresh browser context periodically.
 */
const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  let sql = getDb();
  
  // Get products missing images with their product URLs from any retailer
  const missing = await sql`
    SELECT DISTINCT ON (p.id) p.id, p.name, pr.url, pr.retailer
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.url IS NOT NULL AND pr.url != ''
    ORDER BY p.id, 
      CASE pr.retailer 
        WHEN 'GQ Tobaccos' THEN 1
        WHEN 'Havana House' THEN 2
        WHEN 'Smoke King' THEN 3
        WHEN 'Sautter' THEN 4
        WHEN 'House of Cigars' THEN 5
        WHEN 'Rebellion' THEN 6
        WHEN 'C.Gars Ltd' THEN 7
      END
  `;
  
  console.log('📸 ' + missing.length + ' products need images\n');
  
  // Group by retailer for stats
  const byRetailer = {};
  missing.forEach(m => { byRetailer[m.retailer] = (byRetailer[m.retailer] || 0) + 1; });
  Object.entries(byRetailer).forEach(([r, c]) => console.log('   ' + r + ': ' + c));
  console.log('');
  
  const browser = await chromium.launch({ headless: true });
  let ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  let page = await ctx.newPage();
  
  // Warm up on C.Gars for Cloudflare
  console.log('⏳ Cloudflare warmup...');
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(8000);
  let title = await page.title();
  if (title.includes('Just a moment')) {
    await sleep(15000);
    title = await page.title();
  }
  if (title.includes('Just a moment')) {
    console.log('❌ Cloudflare still blocking, trying anyway...');
  } else {
    console.log('✅ Cloudflare passed\n');
  }
  
  let fixed = 0, failed = 0;
  const BATCH = 50;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    
    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(500);
      
      // Try multiple strategies to find the image
      const imgUrl = await page.evaluate(() => {
        // 1. og:image meta tag
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content) return og.content;
        
        // 2. Main product image (common patterns)
        const selectors = [
          '#product-image img',
          '.product-image img',
          '.product-gallery img',
          '.main-image img',
          '[data-zoom-image]',
          '.woocommerce-product-gallery__image img',
          '.product-single__photo img',
          '.ProductItem-gallery img',
          '.product_image img',
          '.product-photo img',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const src = el.getAttribute('data-zoom-image') || el.getAttribute('data-src') || el.src;
            if (src && !src.includes('placeholder') && !src.includes('no-image')) return src;
          }
        }
        
        // 3. First large image on the page
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
          const src = img.src || '';
          if (src.includes('product') && !src.includes('logo') && !src.includes('icon') && !src.includes('banner')) {
            return src;
          }
        }
        
        // 4. Any image with reasonable dimensions
        for (const img of imgs) {
          if (img.naturalWidth >= 200 && img.naturalHeight >= 200) {
            const src = img.src || '';
            if (!src.includes('logo') && !src.includes('icon') && !src.includes('banner') && !src.includes('payment')) {
              return src;
            }
          }
        }
        
        return null;
      });
      
      if (imgUrl && imgUrl.length > 5) {
        sql = getDb();
        await sql`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        fixed++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      // If page timeout, the site might be blocking us
      if (e.message && e.message.includes('Timeout')) {
        await sleep(2000);
      }
    }
    
    // Progress
    if ((i + 1) % BATCH === 0) {
      console.log('   ' + (i + 1) + '/' + missing.length + ' (fixed: ' + fixed + ', failed: ' + failed + ')');
      
      // Refresh context every 200 to prevent memory issues
      if ((i + 1) % 200 === 0) {
        await page.close();
        await ctx.close();
        ctx = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        });
        page = await ctx.newPage();
        // Re-warm Cloudflare
        await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(5000);
      }
    }
    
    await sleep(300 + Math.random() * 200); // Be polite
  }
  
  await browser.close();
  
  console.log('\n✅ Fixed: ' + fixed);
  console.log('❌ Failed: ' + failed);
  
  // Final stats
  sql = getDb();
  const finalNoImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const finalWithImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  const pct = Math.round((finalWithImg[0].c / (finalWithImg[0].c + finalNoImg[0].c)) * 100);
  console.log('\n📊 Final: ' + finalWithImg[0].c + ' with images, ' + finalNoImg[0].c + ' without (' + pct + '%)');
}

main().catch(console.error);
