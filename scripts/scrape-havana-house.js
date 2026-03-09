/**
 * Scrape Havana House (WooCommerce, JS-rendered).
 * Uses Playwright since the site needs JS to render product grids.
 * Category pages: /product-category/cigars/cuban/ (29 pages)
 *                 /product-category/cigars/new-world/
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

const categoryUrls = [
  'https://www.havanahouse.co.uk/product-category/cigars/cuban/',
  'https://www.havanahouse.co.uk/product-category/cigars/new-world/',
];

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const allProducts = [];

  for (const catUrl of categoryUrls) {
    const catName = catUrl.includes('cuban') ? 'Cuban' : 'New World';
    console.log(`\n📦 Scraping ${catName}...`);
    
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
      const url = pageNum === 1 ? catUrl : `${catUrl}page/${pageNum}/`;
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        const products = await page.evaluate(() => {
          const results = [];
          document.querySelectorAll('.product').forEach(p => {
            const img = p.querySelector('img');
            const title = p.querySelector('.woocommerce-loop-product__title, h2');
            const priceEl = p.querySelector('.woocommerce-Price-amount bdi, .woocommerce-Price-amount');
            const link = p.querySelector('a[href*="/product/"]');
            
            if (!img || !title) return;
            const name = title.textContent.trim();
            if (!name || name.length < 5) return;
            if (name.startsWith('What are')) return; // Skip info cards
            
            let imageUrl = img.src || img.dataset.src || '';
            // Get full-size image (remove -300x300 suffix)
            imageUrl = imageUrl.replace(/-\d+x\d+\./, '.');
            
            let price = null;
            if (priceEl) {
              const priceText = priceEl.textContent.replace(/[^0-9.]/g, '');
              price = parseFloat(priceText) || null;
            }
            
            results.push({
              name,
              imageUrl,
              price,
              url: link ? link.href : ''
            });
          });
          return results;
        });

        if (products.length === 0) {
          hasMore = false;
        } else {
          allProducts.push(...products.map(p => ({ ...p, category: catName })));
          
          // Check for next page
          const hasNext = await page.evaluate(() => {
            const next = document.querySelector('a.next.page-numbers');
            return !!next;
          });
          
          if (hasNext) {
            pageNum++;
            await page.waitForTimeout(500);
          } else {
            hasMore = false;
          }
        }
      } catch (e) {
        console.log(`  ❌ Page ${pageNum}: ${e.message.substring(0, 60)}`);
        hasMore = false;
      }
    }
    
    console.log(`  ✅ ${catName}: ${allProducts.filter(p => p.category === catName).length} products (${pageNum} pages)`);
  }

  await browser.close();

  // Dedupe
  const seen = new Set();
  const unique = allProducts.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n📊 Total: ${allProducts.length} -> ${unique.length} unique`);
  console.log(`   With images: ${unique.filter(p => p.imageUrl).length}`);
  console.log(`   With prices: ${unique.filter(p => p.price).length}`);

  // Save
  const outPath = path.join(__dirname, '..', 'havana-house-cigars.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);

  // Now match images to existing products + add as new retailer
  console.log('\n🔍 Matching to existing products...');
  
  // Build lookup
  const dbProducts = await sql`SELECT id, name, brand, image_url FROM cs_products`;
  const dbLookup = new Map();
  for (const p of dbProducts) {
    const key = normalise(p.name);
    dbLookup.set(key, p);
  }

  let imagesUpdated = 0;
  let pricesAdded = 0;
  let newRetailerLinks = 0;

  for (const hh of unique) {
    const key = normalise(hh.name);
    const match = dbLookup.get(key);

    if (match) {
      // Update image if current one is missing or is a band-only Shopify image
      const currentImg = match.image_url || '';
      const isBandOnly = currentImg.includes('cdn.shopify.com');
      const hasNoImg = !currentImg;
      
      if ((hasNoImg || isBandOnly) && hh.imageUrl && !hh.imageUrl.includes('filter.png')) {
        await sql`UPDATE cs_products SET image_url = ${hh.imageUrl} WHERE id = ${match.id}`;
        imagesUpdated++;
      }

      // Add price entry
      if (hh.price) {
        // Check if Havana House price already exists
        const existingPrice = await sql`
          SELECT id FROM cs_prices WHERE product_id = ${match.id} AND retailer = 'Havana House'
        `;
        if (existingPrice.length === 0) {
          await sql`
            INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, scraped_at)
            VALUES (${match.id}, ${'Havana House'}, ${'https://www.havanahouse.co.uk'}, ${hh.price}, ${'GBP'}, ${true}, ${hh.url}, ${hh.name}, ${new Date()})
          `;
          pricesAdded++;
          newRetailerLinks++;
        }
      }
    }
  }

  // Recalculate retailer counts and min/max prices
  console.log('\n⬆️  Recalculating retailer counts...');
  await sql`
    UPDATE cs_products p SET 
      retailer_count = (SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id),
      min_price = COALESCE((
        SELECT MIN(price) FROM cs_prices WHERE product_id = p.id 
        AND (LOWER(source_name) LIKE '%single%' OR (LOWER(source_name) NOT LIKE '%box of%' AND LOWER(source_name) NOT LIKE '%pack of%' AND LOWER(source_name) NOT LIKE '%bundle of%' AND LOWER(source_name) NOT LIKE '%cabinet of%'))
      ), p.min_price),
      max_price = COALESCE((
        SELECT MAX(price) FROM cs_prices WHERE product_id = p.id
        AND (LOWER(source_name) LIKE '%single%' OR (LOWER(source_name) NOT LIKE '%box of%' AND LOWER(source_name) NOT LIKE '%pack of%' AND LOWER(source_name) NOT LIKE '%bundle of%' AND LOWER(source_name) NOT LIKE '%cabinet of%'))
      ), p.max_price)
  `;

  console.log(`\n🎉 Results:`);
  console.log(`   Images updated: ${imagesUpdated} (replaced missing/band-only)`);
  console.log(`   Prices added: ${pricesAdded}`);
  console.log(`   New retailer links: ${newRetailerLinks}`);

  // Final stats
  const stats = await sql`
    SELECT COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image,
      COUNT(*) FILTER (WHERE retailer_count > 1) as multi
    FROM cs_products
  `;
  const s = stats[0];
  console.log(`\n📊 Final: ${s.total} products, ${s.with_image} with images (${Math.round(s.with_image/s.total*100)}%), ${s.multi} multi-retailer`);
}

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*[–—-]\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*[–—-]\s*(single cigar|box of \d+ cigars?|pack of \d+ cigars?)$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+cuban\s+/gi, ' ')
    .replace(/\s+cigars?\b/gi, '')
    .replace(/\s+tubed\b/gi, '')
    .replace(/\s*[–—-]\s*/g, ' ')
    .replace(/\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

scrape().catch(e => { console.error(e); process.exit(1); });
