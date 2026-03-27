/**
 * Fix missing images by visiting product URLs directly with Playwright.
 * Prioritises retailers with easier scraping (no Cloudflare).
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
        WHEN 'GQ Tobaccos' THEN 1
        WHEN 'Havana House' THEN 2
        WHEN 'Smoke King' THEN 3
        WHEN 'Sautter' THEN 4
        WHEN 'House of Cigars' THEN 5
        WHEN 'Rebellion' THEN 6
        WHEN 'Turmeaus' THEN 7
        WHEN 'C.Gars Ltd' THEN 8
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
  
  // Block images/css/fonts to speed up page loads
  await page.route('**/*.{png,jpg,jpeg,gif,webp,css,woff,woff2,ttf}', route => route.abort());
  
  let fixed = 0, failed = 0;
  const BATCH = 50;
  
  for (let i = 0; i < missing.length; i++) {
    const product = missing[i];
    
    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await sleep(300);
      
      const imgUrl = await page.evaluate(() => {
        // og:image
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content && og.content.length > 10) return og.content;
        
        // Common product image selectors
        const selectors = [
          '#product-image img', '.product-image img', '.product-gallery img',
          '.main-image img', '[data-zoom-image]', '.woocommerce-product-gallery__image img',
          '.product-single__photo img', '.product_image img', '.product-photo img',
          '#imgMain', '.productMainImage img', '.prod-image img',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const src = el.getAttribute('data-zoom-image') || el.getAttribute('data-large-image') || el.getAttribute('data-src') || el.src;
            if (src && !src.includes('placeholder') && !src.includes('no-image') && src.length > 10) return src;
          }
        }
        
        // First product-ish image
        for (const img of document.querySelectorAll('img')) {
          const src = img.src || '';
          if (src.length > 10 && (src.includes('product') || src.includes('cigar')) && 
              !src.includes('logo') && !src.includes('icon') && !src.includes('banner')) {
            return src;
          }
        }
        
        return null;
      });
      
      if (imgUrl && imgUrl.length > 10) {
        const chunkSql = getDb();
        await chunkSql`UPDATE cs_products SET image_url = ${imgUrl} WHERE id = ${product.id}`;
        fixed++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      if (e.message && e.message.includes('Timeout')) await sleep(1000);
    }
    
    if ((i + 1) % BATCH === 0) {
      console.log(`   ${i + 1}/${missing.length} (fixed: ${fixed}, failed: ${failed})`);
    }
    
    // Refresh browser context every 300 pages
    if ((i + 1) % 300 === 0) {
      await page.close();
      await ctx.close();
      ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });
      page = await ctx.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,webp,css,woff,woff2,ttf}', route => route.abort());
    }
    
    await sleep(200 + Math.random() * 300);
  }
  
  await browser.close();
  
  console.log(`\n✅ Fixed: ${fixed}`);
  console.log(`❌ Failed: ${failed}`);
  
  sql = getDb();
  const noImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  const pct = Math.round((parseInt(withImg[0].c) / (parseInt(withImg[0].c) + parseInt(noImg[0].c))) * 100);
  console.log(`\n📊 Final: ${withImg[0].c} with images, ${noImg[0].c} without (${pct}% coverage)`);
}

main().catch(console.error);
