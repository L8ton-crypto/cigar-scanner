/**
 * Direct page visit for remaining missing images.
 * Uses CGars source_name to search their site.
 * Memory-safe with progress tracking.
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);
const PROGRESS_FILE = path.join(__dirname, 'direct-scrape-progress.json');
const MAX_RUNTIME_MS = 8 * 60 * 1000;

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], found: 0, failed: 0 }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p)); }

async function scrape() {
  const startTime = Date.now();
  const progress = loadProgress();
  const doneSet = new Set(progress.done);

  // Get missing products that have CGars prices (so we can search by source_name)
  const missing = await sql`
    SELECT DISTINCT p.id, p.name, p.brand, pr.source_name
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL 
    AND pr.retailer = 'C.Gars Ltd'
    AND p.name NOT LIKE '%Sampler%'
    AND p.name NOT LIKE '%Selection%'
    AND p.name NOT LIKE '%Bundle Deal%'
    AND p.name NOT LIKE '%Packs of%'
    AND p.name NOT LIKE '%Tins of%'
    ORDER BY p.id
  `;

  const remaining = missing.filter(m => !doneSet.has(m.id));
  console.log(`📋 ${remaining.length} products to check (${doneSet.size} already done, ${progress.found} found so far)\n`);

  if (remaining.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  // Cloudflare
  console.log('⏳ Cloudflare warmup...');
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  let title = await page.title();
  if (title.includes('Just a moment')) {
    await page.waitForTimeout(15000);
    title = await page.title();
  }
  if (title.includes('Just a moment')) {
    console.log('❌ Cloudflare blocked');
    await browser.close();
    return;
  }
  console.log('✅ Cloudflare passed\n');

  // Use CGars advanced search to find products
  let found = progress.found;
  let failed = progress.failed;

  for (let i = 0; i < remaining.length; i++) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`\n⏰ Time limit. Found: ${found}, Failed: ${failed}`);
      break;
    }

    const prod = remaining[i];
    
    // Build search query from product name - use key identifying words
    const searchName = prod.name
      .replace(/^LCDH\s+/i, '')
      .replace(/\s+Cuban$/i, '')
      .replace(/\s+Tubed$/i, '')
      .replace(/\s+(Cigar|Cigars)$/i, '')
      .trim();

    try {
      // Use CGars search
      const searchUrl = `https://www.cgarsltd.co.uk/advanced_search_result.php?keywords=${encodeURIComponent(searchName)}&search_in_description=0`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      // Check if search returned results
      const pageTitle = await page.title();
      if (pageTitle.includes('Page not found') || pageTitle.includes('Just a moment')) {
        progress.done.push(prod.id);
        doneSet.add(prod.id);
        failed++;
        continue;
      }

      // Look for product images in search results
      const results = await page.evaluate(() => {
        const items = [];
        const links = document.querySelectorAll('a[href*="-p-"], a[href*="-p.asp"]');
        const seen = new Set();
        for (const link of links) {
          const img = link.querySelector('img');
          if (!img || !img.src) continue;
          if (img.src.includes('free-delivery') || img.src.includes('logo') || img.src.includes('icon')) continue;
          const name = img.alt || link.textContent.trim();
          if (!name || name.length < 5 || seen.has(name)) continue;
          seen.add(name);
          items.push({ name, imageUrl: img.src.replace(/\/optimize\/\d+x\d+_/, '/optimize/400x400_') });
        }
        return items;
      });

      // Find best match
      let bestMatch = null;
      const searchNorm = searchName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      
      for (const r of results) {
        const rNorm = r.name.toLowerCase()
          .replace(/\s*-\s*(1 single|single|pack of|box of|tin of|bundle of).*$/i, '')
          .replace(/\s*cigar(s)?\s*$/i, '')
          .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (rNorm === searchNorm || rNorm.includes(searchNorm) || searchNorm.includes(rNorm)) {
          bestMatch = r;
          break;
        }
      }

      // If no exact match, take first result if search was specific enough
      if (!bestMatch && results.length > 0 && results.length <= 5 && searchName.split(' ').length >= 3) {
        bestMatch = results[0];
      }

      if (bestMatch) {
        await sql`UPDATE cs_products SET image_url = ${bestMatch.imageUrl} WHERE id = ${prod.id}`;
        found++;
        if (found % 20 === 0) console.log(`  ✅ ${found} found so far... (at ${prod.name})`);
      } else {
        failed++;
      }

      progress.done.push(prod.id);
      doneSet.add(prod.id);

      // Save every 25
      if ((found + failed) % 25 === 0) saveProgress(progress);
      
      await page.waitForTimeout(600 + Math.random() * 400);
    } catch (e) {
      progress.done.push(prod.id);
      doneSet.add(prod.id);
      failed++;
    }
  }

  await browser.close();
  
  progress.found = found;
  progress.failed = failed;
  saveProgress(progress);

  // Stats
  const final = await sql`
    SELECT COUNT(*) as total, COUNT(image_url) FILTER (WHERE image_url IS NOT NULL) as with_img FROM cs_products
  `;
  const pct = Math.round((final[0].with_img / final[0].total) * 100);
  console.log(`\n✅ Found: ${found} | Not found: ${failed}`);
  console.log(`📊 Coverage: ${final[0].with_img}/${final[0].total} (${pct}%)`);
  
  const stillMissing = remaining.length - (found + failed - progress.found - progress.failed);
  if (remaining.filter(m => !doneSet.has(m.id)).length > 0) {
    console.log(`⏳ Run again to continue (${remaining.filter(m => !doneSet.has(m.id)).length} remaining)`);
  } else {
    console.log('🏁 All non-sampler products checked!');
  }
}

scrape().catch(e => { console.error(e); process.exit(1); });
