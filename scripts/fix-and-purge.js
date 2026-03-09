/**
 * Fix broken URLs + purge outdated products.
 * 1. Search CGars for every product with missing image OR broken -p.asp URL
 * 2. If found: update image + URL
 * 3. If not found (missing image products): delete them
 * 4. If not found (broken URL only): remove the CGars price entry
 * Memory-safe with 8-min timeout + progress file.
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);
const PROGRESS_FILE = path.join(__dirname, 'fix-purge-progress.json');
const MAX_RUNTIME_MS = 8 * 60 * 1000;

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], stats: { found: 0, deleted: 0, urlFixed: 0, urlRemoved: 0 } }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p)); }

async function searchCGars(page, searchName) {
  const searchUrl = `https://www.cgarsltd.co.uk/advanced_search_result.php?keywords=${encodeURIComponent(searchName)}&search_in_description=0`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1200);

  const title = await page.title();
  if (title.includes('Page not found') || title.includes('Just a moment')) return null;

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
      items.push({
        name,
        imageUrl: img.src.replace(/\/optimize\/\d+x\d+_/, '/optimize/400x400_'),
        url: link.href
      });
    }
    return items;
  });

  return results;
}

function normForMatch(name) {
  return name.toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of|box of|tin of|bundle of|cabinet of|twist of).*$/i, '')
    .replace(/\s*cigar(illos?|s)?\s*$/i, '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMatch(results, searchName) {
  const searchNorm = normForMatch(searchName);
  
  // Exact match
  for (const r of results) {
    if (normForMatch(r.name) === searchNorm) return r;
  }
  // Contains match
  for (const r of results) {
    const rNorm = normForMatch(r.name);
    if (rNorm.includes(searchNorm) || searchNorm.includes(rNorm)) return r;
  }
  // If few results and search was specific, take first
  if (results.length > 0 && results.length <= 3 && searchName.split(' ').length >= 3) {
    return results[0];
  }
  return null;
}

async function run() {
  const startTime = Date.now();
  const progress = loadProgress();
  const doneSet = new Set(progress.done);
  const stats = progress.stats;

  // Get all products needing attention:
  // A) Missing images (will delete if not found)
  const missingImg = await sql`
    SELECT p.id, p.name, p.brand, 'missing_image' as reason
    FROM cs_products p
    WHERE p.image_url IS NULL
    ORDER BY p.id
  `;

  // B) Products with broken -p.asp URLs that DO have images (just need URL fix)
  const brokenUrls = await sql`
    SELECT DISTINCT p.id, p.name, p.brand, 'broken_url' as reason
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE pr.retailer = 'C.Gars Ltd'
    AND pr.url LIKE '%-p.asp'
    AND p.image_url IS NOT NULL
    ORDER BY p.id
  `;

  // Combine, missing images first (higher priority)
  const allWork = [...missingImg, ...brokenUrls];
  const remaining = allWork.filter(w => !doneSet.has(`${w.reason}:${w.id}`));
  
  console.log(`📋 Total work: ${remaining.length} (${missingImg.length} missing images, ${brokenUrls.length} broken URLs)`);
  console.log(`   Already done: ${doneSet.size} | Found: ${stats.found} | Deleted: ${stats.deleted} | URL fixed: ${stats.urlFixed}\n`);

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

  let processed = 0;

  for (const item of remaining) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`\n⏰ Time limit reached.`);
      break;
    }

    const key = `${item.reason}:${item.id}`;
    const searchName = item.name
      .replace(/^LCDH\s+/i, '')
      .replace(/\s+Cuban$/i, '')
      .replace(/\s+(Cigar|Cigars)$/i, '')
      .replace(/\s+\d+\s*(Packs?|Tins?|Boxes?)\s+of\s+\d+.*$/i, '')
      .replace(/\s+\d+\s*x\s+Box.*$/i, '')
      .replace(/\s+Bundle Deal.*$/i, '')
      .trim();

    try {
      const results = await searchCGars(page, searchName);
      const match = results ? findBestMatch(results, searchName) : null;

      if (match) {
        if (item.reason === 'missing_image') {
          // Update image + URL
          await sql`UPDATE cs_products SET image_url = ${match.imageUrl} WHERE id = ${item.id}`;
          await sql`UPDATE cs_prices SET url = ${match.url} WHERE product_id = ${item.id} AND retailer = 'C.Gars Ltd'`;
          stats.found++;
        } else {
          // Just fix the URL
          await sql`UPDATE cs_prices SET url = ${match.url} WHERE product_id = ${item.id} AND retailer = 'C.Gars Ltd'`;
          stats.urlFixed++;
        }
      } else {
        if (item.reason === 'missing_image') {
          // Product not on CGars anymore - delete it
          await sql`DELETE FROM cs_prices WHERE product_id = ${item.id}`;
          await sql`DELETE FROM cs_products WHERE id = ${item.id}`;
          stats.deleted++;
        } else {
          // URL broken but can't find replacement - remove CGars price entry
          // Keep the product if it has prices from other retailers
          await sql`DELETE FROM cs_prices WHERE product_id = ${item.id} AND retailer = 'C.Gars Ltd' AND url LIKE '%-p.asp'`;
          stats.urlRemoved++;
        }
      }
    } catch (e) {
      // Skip on error
    }

    progress.done.push(key);
    doneSet.add(key);
    processed++;

    if (processed % 25 === 0) {
      saveProgress(progress);
      console.log(`  ... ${processed} processed (found: ${stats.found}, deleted: ${stats.deleted}, urls: ${stats.urlFixed})`);
    }

    await page.waitForTimeout(600 + Math.random() * 400);
  }

  await browser.close();
  saveProgress(progress);

  // Recalculate stats
  await sql`
    UPDATE cs_products p SET 
      retailer_count = COALESCE((SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id), 0),
      min_price = COALESCE((SELECT MIN(price) FROM cs_prices WHERE product_id = p.id), p.min_price),
      max_price = COALESCE((SELECT MAX(price) FROM cs_prices WHERE product_id = p.id), p.max_price)
  `;

  // Clean orphans
  const orphans = await sql`
    DELETE FROM cs_products WHERE NOT EXISTS (SELECT 1 FROM cs_prices WHERE product_id = cs_products.id) RETURNING id
  `;

  const final = await sql`SELECT COUNT(*) as c, COUNT(image_url) FILTER (WHERE image_url IS NOT NULL) as img FROM cs_products`;
  const pct = Math.round(final[0].img / final[0].c * 100);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Processed: ${processed}`);
  console.log(`   Images found: ${stats.found} | Products deleted: ${stats.deleted}`);
  console.log(`   URLs fixed: ${stats.urlFixed} | URLs removed: ${stats.urlRemoved}`);
  console.log(`   Orphans cleaned: ${orphans.length}`);
  console.log(`📊 Final: ${final[0].c} products, ${final[0].img} images (${pct}%)`);
  
  const left = remaining.length - processed;
  if (left > 0) console.log(`⏳ ${left} remaining - run again to continue`);
  else console.log('🏁 All done!');
}

run().catch(e => { console.error(e); process.exit(1); });
