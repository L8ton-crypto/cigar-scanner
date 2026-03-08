/**
 * Scrape CGars product images via category pages (Playwright for Cloudflare).
 * Uses real category URLs discovered from the CGars navigation.
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

// Real CGars category URLs from their nav
const categoryUrls = [
  // Cuban
  'cuban-cigars-bolivar-cigars-c-317_101_137.html',
  'cuban-cigars-cohiba-cigars-c-317_101_147.html',
  'cuban-cigars-cuaba-cigars-c-317_101_148.html',
  'cuban-cigars-diplomaticos-cigars-c-317_101_149.html',
  'cuban-cigars-rey-del-mundo-cigars-c-317_101_150.html',
  'cuban-cigars-fonseca-cigars-c-317_101_151.html',
  'cuban-cigars-guantanamera-cigars-c-317_101_382.html',
  'cuban-cigars-upmann-cigars-c-317_101_152.html',
  'cuban-cigars-hoyo-monterrey-cigars-c-317_101_153.html',
  'cuban-cigars-jose-piedra-cigars-c-317_101_383.html',
  'cuban-cigars-juan-lopez-cigars-c-317_101_155.html',
  'cuban-cigars-flor-cano-cigars-c-317_101_156.html',
  'cuban-cigars-gloria-cubana-cigars-c-317_101_157.html',
  'cuban-cigars-montecristo-cigars-c-317_101_158.html',
  'cuban-cigars-partagas-cigars-c-317_101_160.html',
  'cuban-cigars-por-larranaga-cigars-c-317_101_161.html',
  'cuban-cigars-punch-cigars-c-317_101_162.html',
  'cuban-cigars-quai-dorsay-cigars-c-317_101_163.html',
  'cuban-cigars-quintero-cigars-c-317_101_164.html',
  'cuban-cigars-rafael-gonzalez-cigars-c-317_101_165.html',
  'cuban-cigars-ramon-allones-cigars-c-317_101_166.html',
  'cuban-cigars-romeo-julieta-cigars-c-317_101_167.html',
  'cuban-cigars-saint-luis-rey-cigars-c-317_101_168.html',
  'cuban-cigars-san-cristobal-cigars-c-317_101_457.html',
  'cuban-cigars-sancho-panza-cigars-c-317_101_169.html',
  'cuban-cigars-trinidad-cigars-c-317_101_170.html',
  'cuban-cigars-vegas-robaina-cigars-c-317_101_171.html',
  'cuban-cigars-vegueros-cigars-c-317_101_384.html',
  // New World (from nav)
  'new-world-cigars-fernandez-cigars-c-317_102_2656.html',
  'new-world-cigars-aladino-cigars-c-317_102_2657.html',
  'new-world-cigars-alec-bradley-cigars-c-317_102_107.html',
  'new-world-cigars-arturo-fuente-cigars-c-317_102_432.html',
  'new-world-cigars-avo-cigars-c-317_102_437.html',
  'new-world-cigars-brick-house-cigars-c-317_102_501.html',
  'new-world-cigars-camacho-cigars-c-317_102_455.html',
  'new-world-cigars-cao-cigars-c-317_102_1046.html',
  'new-world-cigars-casa-turrent-cigars-c-317_102_789.html',
  'new-world-cigars-charatan-cigars-c-317_102_108.html',
  'new-world-cigars-chinchalero-cigars-c-317_102_229.html',
  'new-world-cigars-davidoff-cigars-c-317_102_110.html',
  'new-world-cigars-drew-estate-cigars-c-317_102_2396.html',
  'new-world-cigars-flor-selva-cigars-c-317_102_2934.html',
  'new-world-cigars-foundation-cigars-c-317_102_3023.html',
  'new-world-cigars-gurkha-cigars-c-317_102_1184.html',
  'new-world-cigars-inka-secret-blend-cigars-c-317_102_594.html',
  'new-world-cigars-joya-nicaragua-cigars-c-317_102_720.html',
  'new-world-cigars-kristoff-cigars-c-317_102_2955.html',
  'new-world-cigars-aurora-cigars-c-317_102_444.html',
  'new-world-cigars-flor-dominicana-cigars-c-317_102_561.html',
  'new-world-cigars-invicta-cigars-c-317_102_121.html',
  'new-world-cigars-macanudo-cigars-c-317_102_123.html',
  'new-world-cigars-father-cigars-c-317_102_545.html',
  'new-world-cigars-oliva-cigars-c-317_102_275.html',
  'new-world-cigars-oscar-valladares-cigars-c-317_102_2660.html',
  'new-world-cigars-padron-cigars-c-317_102_484.html',
  'new-world-cigars-perdomo-cigars-c-317_102_2904.html',
  'new-world-cigars-plasencia-cigars-c-317_102_515.html',
  'new-world-cigars-quorum-cigars-c-317_102_127.html',
  'new-world-cigars-regius-cigars-c-317_102_439.html',
  'new-world-cigars-rocky-patel-cigars-c-317_102_375.html',
  'new-world-cigars-tatuaje-cigars-c-317_102_481.html',
  'new-world-cigars-mitchellero-cigars-c-317_102_1232.html',
  'new-world-cigars-conquistador-cigars-c-317_102_757.html',
  'new-world-cigars-puffin-cigars-c-317_102_3185.html',
  'new-world-cigars-zino-selection-cigars-c-317_102_248.html',
];

async function scrape() {
  // Build DB lookup
  const dbEntries = await sql`
    SELECT id, name FROM cs_cigars 
    WHERE retailer = 'C.Gars Ltd' AND (image_url IS NULL OR image_url = '')
  `;
  const dbLookup = new Map();
  for (const e of dbEntries) {
    const key = normalise(e.name);
    if (!dbLookup.has(key)) dbLookup.set(key, []);
    dbLookup.get(key).push(e.id);
  }
  console.log(`📋 ${dbEntries.length} CGars entries need images (${dbLookup.size} unique)\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  // Cloudflare
  console.log('⏳ Cloudflare...');
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  let title = await page.title();
  if (title.includes('Just a moment')) {
    await page.waitForTimeout(10000);
    title = await page.title();
  }
  if (title.includes('Just a moment')) {
    console.log('❌ Cloudflare blocked');
    await browser.close();
    return;
  }
  console.log('✅ Passed\n');

  let totalUpdated = 0;

  for (const catPath of categoryUrls) {
    const url = `https://www.cgarsltd.co.uk/${catPath}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      // Extract all product links with images from category page
      const products = await page.evaluate(() => {
        const results = [];
        // Find all links to product pages (ending in -p-XXXXX.html or -p.asp)
        const links = document.querySelectorAll('a[href*="-p-"], a[href*="-p.asp"]');
        for (const link of links) {
          const img = link.querySelector('img');
          if (!img || !img.src) continue;
          if (img.src.includes('placeholder') || img.src.includes('logo') || img.src.includes('icon')) continue;
          if (img.naturalWidth < 50 && img.width < 50) continue;
          
          const name = img.alt || link.textContent.trim();
          if (!name || name.length < 3) continue;
          
          results.push({ name, imageUrl: img.src });
        }
        
        // Also try: look for product grid items
        if (results.length === 0) {
          const imgs = document.querySelectorAll('img[alt]');
          for (const img of imgs) {
            if (!img.src || img.naturalWidth < 100) continue;
            if (img.src.includes('logo') || img.src.includes('icon') || img.src.includes('banner') || img.src.includes('404')) continue;
            if (img.alt && img.alt.length > 10) {
              results.push({ name: img.alt, imageUrl: img.src });
            }
          }
        }
        return results;
      });

      // Check for pagination and scrape additional pages
      let allProducts = [...products];
      let pageNum = 2;
      let maxPages = 20;
      
      while (pageNum <= maxPages) {
        const hasNext = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const a of links) {
            if (a.textContent.trim() === '»' || a.textContent.trim() === 'Next' || a.textContent.includes('Next')) {
              return a.href;
            }
          }
          return null;
        });
        
        if (!hasNext) break;
        
        await page.goto(hasNext, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);
        
        const moreProducts = await page.evaluate(() => {
          const results = [];
          const links = document.querySelectorAll('a[href*="-p-"], a[href*="-p.asp"]');
          for (const link of links) {
            const img = link.querySelector('img');
            if (!img || !img.src) continue;
            if (img.src.includes('placeholder') || img.src.includes('logo')) continue;
            const name = img.alt || link.textContent.trim();
            if (!name || name.length < 3) continue;
            results.push({ name, imageUrl: img.src });
          }
          return results;
        });
        
        if (moreProducts.length === 0) break;
        allProducts.push(...moreProducts);
        pageNum++;
      }

      // Match to DB
      let matched = 0;
      for (const prod of allProducts) {
        const key = normalise(prod.name);
        const ids = dbLookup.get(key);
        if (ids && ids.length > 0) {
          for (const id of ids) {
            await sql`UPDATE cs_cigars SET image_url = ${prod.imageUrl} WHERE id = ${id}`;
            totalUpdated++;
            matched++;
          }
          dbLookup.delete(key);
        }
      }

      const brandName = catPath.split('-c-')[0].replace(/.*cigars-/, '').replace(/-/g, ' ');
      if (allProducts.length > 0 || matched > 0) {
        console.log(`  ${brandName}: ${allProducts.length} products, ${matched} matched${pageNum > 2 ? ` (${pageNum-1} pages)` : ''}`);
      }

      await page.waitForTimeout(300 + Math.random() * 400);
    } catch (e) {
      // Silently skip errors
    }
  }

  await browser.close();

  console.log(`\n✅ Total images updated: ${totalUpdated}`);
  
  const stats = await sql`
    SELECT COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars WHERE retailer = 'C.Gars Ltd'
  `;
  const pct = Math.round((stats[0].with_image / stats[0].total) * 100);
  console.log(`📸 CGars: ${stats[0].with_image}/${stats[0].total} (${pct}%)`);
}

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/\s+cigars?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

scrape().catch(e => { console.error(e); process.exit(1); });
