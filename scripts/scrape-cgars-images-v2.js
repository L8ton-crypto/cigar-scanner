/**
 * Scrape CGars product images via NEW category URLs (2026 site structure).
 * Updates cs_products with image_url from category page listings.
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }
const sql = getDb();

// New CGars category URLs (discovered from site nav March 2026)
const categoryUrls = [
  // Cuban brands
  'cuban-cigars-bolivar-cigars-c-317_44_49.html',
  'cuban-cigars-cohiba-cigars-c-317_44_48.html',
  'cuban-cigars-cuaba-cigars-c-317_44_70.html',
  'cuban-cigars-diplomaticos-cigars-c-317_44_137.html',
  'cuban-cigars-rey-del-mundo-cigars-c-317_44_65.html',
  'cuban-cigars-fonseca-cigars-c-317_44_69.html',
  'cuban-cigars-guantanamera-cigars-c-317_44_207.html',
  'cuban-cigars-upmann-cigars-c-317_44_57.html',
  'cuban-cigars-hoyo-monterrey-cigars-c-317_44_56.html',
  'cuban-cigars-jose-piedra-cigars-c-317_44_73.html',
  'cuban-cigars-juan-lopez-cigars-c-317_44_66.html',
  'cuban-cigars-flor-cano-cigars-c-317_44_573.html',
  'cuban-cigars-gloria-cubana-cigars-c-317_44_398.html',
  'cuban-cigars-montecristo-cigars-c-317_44_52.html',
  'cuban-cigars-partagas-cigars-c-317_44_58.html',
  'cuban-cigars-por-larranaga-cigars-c-317_44_297.html',
  'cuban-cigars-punch-cigars-c-317_44_60.html',
  'cuban-cigars-quai-dorsay-cigars-c-317_44_479.html',
  'cuban-cigars-quintero-cigars-c-317_44_63.html',
  'cuban-cigars-rafael-gonzalez-cigars-c-317_44_67.html',
  'cuban-cigars-ramon-allones-cigars-c-317_44_68.html',
  'cuban-cigars-romeo-julieta-cigars-c-317_44_54.html',
  'cuban-cigars-saint-luis-rey-cigars-c-317_44_59.html',
  'cuban-cigars-san-cristobal-cigars-c-317_44_457.html',
  'cuban-cigars-sancho-panza-cigars-c-317_44_169.html',
  'cuban-cigars-trinidad-cigars-c-317_44_170.html',
  'cuban-cigars-vegas-robaina-cigars-c-317_44_171.html',
  'cuban-cigars-vegueros-cigars-c-317_44_384.html',
  // General browse pages (catch more)
  'shop/all-cigars',
  'shop/single-cigars',
  'shop/boxes-of-cigars',
  'shop/bundles-of-cigars',
  'shop/packs-of-cigars',
  'shop/tins-of-cigars',
];

// Also try to discover new-world brand URLs dynamically
const newWorldBrands = [
  'fernandez', 'aladino', 'alec-bradley', 'arturo-fuente', 'avo',
  'brick-house', 'camacho', 'cao', 'casa-turrent', 'charatan',
  'chinchalero', 'davidoff', 'drew-estate', 'flor-selva', 'foundation',
  'gurkha', 'inka-secret-blend', 'joya-nicaragua', 'kristoff',
  'aurora', 'flor-dominicana', 'invicta', 'macanudo', 'father',
  'oliva', 'oscar-valladares', 'padron', 'perdomo', 'plasencia',
  'quorum', 'regius', 'rocky-patel', 'tatuaje', 'mitchellero',
  'conquistador', 'puffin', 'zino-selection', 'juliany', 'luis-martinez',
  'la-galera', 'estrella', 'meerapfel', 'silencio', 'chateau-diadem',
  'diamond-crown', 'cle',
];

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*cigar(illos?|s)?\s*$/i, '')
    .replace(/\s*\(best dad band\).*$/i, '')
    .replace(/\s*\(happy birthday band\).*$/i, '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractProducts(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const links = document.querySelectorAll('a');
    for (const link of links) {
      if (!link.href.includes('-p-') && !link.href.includes('-p.asp')) continue;
      const img = link.querySelector('img');
      if (!img || !img.src) continue;
      if (img.src.includes('free-delivery') || img.src.includes('logo') || img.src.includes('icon') || img.src.includes('banner')) continue;
      const name = img.alt || link.textContent.trim();
      if (!name || name.length < 5 || seen.has(name)) continue;
      seen.add(name);
      // Get highest quality image URL
      let imageUrl = img.src;
      // Remove size prefix for full image if possible
      imageUrl = imageUrl.replace(/\/optimize\/\d+x\d+_/, '/optimize/400x400_');
      results.push({ name, imageUrl });
    }
    return results;
  });
}

async function scrapeCategory(page, url) {
  const allProducts = [];
  let currentUrl = url;
  let pageNum = 1;

  while (currentUrl && pageNum <= 50) {
    try {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Scroll to load lazy images
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(500);

      const products = await extractProducts(page);
      if (products.length === 0) break;
      allProducts.push(...products);

      // Check for next page
      const nextUrl = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a')];
        for (const a of links) {
          if (a.textContent.includes('Next') || a.textContent.includes('>>')) return a.href;
        }
        return null;
      });

      if (!nextUrl || nextUrl === currentUrl) break;
      currentUrl = nextUrl;
      pageNum++;
      await page.waitForTimeout(400);
    } catch (e) {
      break;
    }
  }

  return { products: allProducts, pages: pageNum };
}

async function scrape() {
  // Load products missing images
  const products = await sql`SELECT id, name, brand FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  
  // Build lookup with multiple normalisation strategies
  const lookup = new Map();
  for (const p of products) {
    const norm = normalise(p.name);
    if (norm.length >= 3) {
      if (!lookup.has(norm)) lookup.set(norm, []);
      lookup.get(norm).push(p.id);
    }
    // Also without brand prefix for matching
    if (p.brand) {
      const brandNorm = normalise(p.brand);
      if (norm.startsWith(brandNorm)) {
        const withoutBrand = norm.slice(brandNorm.length).trim();
        if (withoutBrand.length >= 5) {
          if (!lookup.has(withoutBrand)) lookup.set(withoutBrand, []);
          lookup.get(withoutBrand).push(p.id);
        }
      }
    }
  }

  console.log(`📋 ${products.length} products need images (${lookup.size} match keys)\n`);

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
    console.log('  Waiting longer...');
    await page.waitForTimeout(15000);
    title = await page.title();
  }
  if (title.includes('Just a moment')) {
    console.log('❌ Cloudflare blocked');
    await browser.close();
    return;
  }
  console.log('✅ Cloudflare passed\n');

  // Also discover new-world brand URLs from the nav
  const navLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => a.href.includes('cgarsltd.co.uk') && a.href.includes('-c-'))
      .map(a => a.href.replace('https://www.cgarsltd.co.uk/', ''))
      .filter(h => h.includes('cigars-c-'));
  });
  
  // Add any nav links not already in our list
  const existing = new Set(categoryUrls);
  for (const link of navLinks) {
    if (!existing.has(link)) {
      categoryUrls.push(link);
      existing.add(link);
    }
  }
  console.log(`📂 ${categoryUrls.length} category URLs to scrape\n`);

  let totalUpdated = 0;
  const updated = new Set();
  let totalScraped = 0;

  for (let i = 0; i < categoryUrls.length; i++) {
    const catPath = categoryUrls[i];
    const url = `https://www.cgarsltd.co.uk/${catPath}`;
    const label = catPath.replace(/.*cigars-|-c-.*|\.html/g, '').replace(/-/g, ' ').trim() || catPath;

    const { products: catProducts, pages } = await scrapeCategory(page, url);
    totalScraped += catProducts.length;

    let matched = 0;
    for (const prod of catProducts) {
      const normName = normalise(prod.name);

      // Try exact
      let ids = lookup.get(normName);

      // Try without trailing "cigar"
      if (!ids) {
        const shorter = normName.replace(/\s*cigar$/, '').trim();
        ids = lookup.get(shorter);
      }

      // Try with "tubed" removed
      if (!ids) {
        const noTubed = normName.replace(/\s*(tubed|untubed|tubos)$/, '').trim();
        ids = lookup.get(noTubed);
      }

      // Try partial: if scraped name contains a DB key
      if (!ids) {
        let bestIds = null;
        let bestLen = 0;
        for (const [key, keyIds] of lookup) {
          if (key.length >= 10 && normName.includes(key) && key.length > bestLen) {
            bestIds = keyIds;
            bestLen = key.length;
          }
          // Also check if DB name contains scraped name
          if (normName.length >= 10 && key.includes(normName) && normName.length > bestLen) {
            bestIds = keyIds;
            bestLen = normName.length;
          }
        }
        if (bestLen >= 15) ids = bestIds;
      }

      if (ids) {
        for (const id of ids) {
          if (updated.has(id)) continue;
          await getDb()`UPDATE cs_products SET image_url = ${prod.imageUrl} WHERE id = ${id}`;
          updated.add(id);
          totalUpdated++;
          matched++;
        }
      }
    }

    if (catProducts.length > 0) {
      console.log(`  [${i+1}/${categoryUrls.length}] ${label}: ${catProducts.length} products, ${matched} matched${pages > 1 ? ` (${pages} pages)` : ''}`);
    }

    await page.waitForTimeout(300 + Math.random() * 400);
  }

  await browser.close();

  // Stats
  const remaining = await getDb()`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  console.log(`\n✅ Updated ${totalUpdated} product images (scraped ${totalScraped} total)`);
  console.log(`📸 Still missing: ${remaining[0].c}`);

  const total = await getDb()`
    SELECT COUNT(*) as total, COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_img FROM cs_products
  `;
  const pct = Math.round((total[0].with_img / total[0].total) * 100);
  console.log(`📊 Coverage: ${total[0].with_img}/${total[0].total} (${pct}%)`);
}

scrape().catch(e => { console.error(e); process.exit(1); });
