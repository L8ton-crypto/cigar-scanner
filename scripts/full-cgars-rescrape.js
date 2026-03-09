/**
 * Full CGars re-scrape: refresh existing products + add new ones.
 * Memory-safe: processes one page at a time, clears references, saves progress.
 * Restartable: tracks progress in a JSON file.
 */

const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);
const PROGRESS_FILE = path.join(__dirname, 'cgars-progress.json');
const BATCH_SIZE = 10; // DB writes per batch
const PAGE_DELAY = 800;
const MAX_RUNTIME_MS = 8 * 60 * 1000; // 8 min safety limit

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch { return { completedCats: [], stats: { newProducts: 0, updatedImages: 0, updatedUrls: 0, newPrices: 0 } }; }
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*cigar(illos?|s)?\s*$/i, '')
    .replace(/\s*\(best dad band\).*$/i, '')
    .replace(/\s*\(happy birthday band\).*$/i, '')
    .replace(/\s*\(formerly .*?\)$/i, '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBrand(productName) {
  // Common brand prefixes
  const brands = [
    'Arturo Fuente', 'Alec Bradley', 'A.J. Fernandez', 'AJ Fernandez',
    'Brick House', 'Casa Turrent', 'Chateau Diadem', 'Diamond Crown',
    'Drew Estate', 'El Rey del Mundo', 'Flor De Selva', 'Foundation Cigars',
    'H. Upmann', 'Hoyo de Monterrey', 'Inka Secret Blend',
    'Joya de Nicaragua', 'Joya De Nicaragua', 'Jose L Piedra',
    'Juan Lopez', 'La Aurora', 'La Estrella', 'La Flor de Cano',
    'La Flor Dominicana', 'La Galera', 'La Gloria Cubana', 'La Invicta',
    'Luis Martinez', 'M by Macanudo', 'My Father', 'Oscar Valladares',
    'Por Larranaga', 'Quai d\'Orsay', 'Rafael Gonzalez', 'Ramon Allones',
    'Rocky Patel', 'Romeo y Julieta', 'San Cristobal', 'San Lotano',
    'Saint Luis Rey', 'Sancho Panza', 'Vegas Robaina',
    'Cohiba', 'Bolivar', 'Montecristo', 'Partagas', 'Punch', 'Trinidad',
    'Davidoff', 'Oliva', 'Padron', 'Perdomo', 'Plasencia', 'Camacho',
    'CAO', 'Gurkha', 'Kristoff', 'Macanudo', 'Regius', 'Tatuaje',
    'Mitchellero', 'Conquistador', 'Charatan', 'Chinchalero', 'Cuaba',
    'Diplomaticos', 'Fonseca', 'Guantanamera', 'Quintero', 'Vegueros',
    'AVO', 'CLE', 'Juliany', 'Meerapfel', 'Silencio', 'Puffin',
    'Aladino', 'Curivari', 'Dunhill', 'Flor De Oliva', 'Neos',
    'Villiger', 'Hamlet', 'Ritmeester', 'Moments', 'Al Capone',
    'Zino Selection', 'LCDH',
  ];
  for (const b of brands) {
    if (productName.startsWith(b + ' ')) return b;
  }
  // Fallback: first word(s) before common size words
  const m = productName.match(/^(.+?)\s+(Robusto|Corona|Churchill|Toro|Torpedo|Petit|No\.|Especial|Siglo|Serie|Double|Short|Epicure|Magnum|Media|Club|Puritos|Joyitas|Open|Maduro|Connecticut|Habano)/i);
  if (m) return m[1].trim();
  return productName.split(' ')[0];
}

async function extractPageProducts(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    
    // Find product cards with links, images, and prices
    const allLinks = document.querySelectorAll('a[href*="-p-"], a[href*="-p.asp"]');
    
    for (const link of allLinks) {
      const img = link.querySelector('img');
      if (!img || !img.src) continue;
      if (img.src.includes('free-delivery') || img.src.includes('logo') || img.src.includes('icon') || img.src.includes('banner')) continue;
      
      const name = img.alt || link.textContent.trim();
      if (!name || name.length < 5 || seen.has(name)) continue;
      seen.add(name);
      
      let imageUrl = img.src;
      imageUrl = imageUrl.replace(/\/optimize\/\d+x\d+_/, '/optimize/400x400_');
      
      // Try to find price near this product
      let price = null;
      const card = link.closest('.product-card, .product-item, [class*=product], li, article') || link.parentElement?.parentElement;
      if (card) {
        const priceText = card.textContent.match(/£\s*([\d,]+\.?\d*)/);
        if (priceText) price = parseFloat(priceText[1].replace(',', ''));
      }
      
      results.push({ name, imageUrl, url: link.href, price });
    }
    return results;
  });
}

async function scrape() {
  const startTime = Date.now();
  const progress = loadProgress();
  const completedSet = new Set(progress.completedCats);
  const stats = progress.stats;

  // Build all category URLs
  const categoryUrls = [
    // Cuban
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
    // Browse pages (single cigars is the big one)
    'shop/single-cigars',
    'shop/boxes-of-cigars',
    'shop/bundles-of-cigars',
    'shop/packs-of-cigars',
    'shop/tins-of-cigars',
  ];

  // Filter to only remaining
  const remaining = categoryUrls.filter(u => !completedSet.has(u));
  console.log(`📂 ${remaining.length} categories remaining (${completedSet.size} already done)`);
  console.log(`📊 Running stats: +${stats.newProducts} products, +${stats.updatedImages} images, +${stats.newPrices} prices\n`);

  // Load existing products for matching
  const existingProducts = await sql`SELECT id, name, brand, image_url FROM cs_products`;
  const productLookup = new Map();
  for (const p of existingProducts) {
    const key = normalise(p.name);
    productLookup.set(key, p);
  }
  console.log(`📋 ${existingProducts.length} existing products loaded\n`);

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

  for (let i = 0; i < remaining.length; i++) {
    // Time check
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`\n⏰ Time limit reached (${Math.round(MAX_RUNTIME_MS/60000)}min). Saving progress...`);
      saveProgress(progress);
      break;
    }

    const catPath = remaining[i];
    const label = catPath.replace(/.*cigars-|-c-.*|\.html|shop\//g, '').replace(/-/g, ' ').trim() || catPath;
    let catNew = 0, catImgUpdate = 0, catUrlUpdate = 0, catPriceNew = 0;

    try {
      let currentUrl = `https://www.cgarsltd.co.uk/${catPath}`;
      let pageNum = 1;

      while (currentUrl && pageNum <= 50) {
        // Time check per page
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1200);

        // Scroll to load lazy images
        for (let s = 0; s < 8; s++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(100);
        }
        await page.waitForTimeout(300);

        const pageProducts = await extractPageProducts(page);
        if (pageProducts.length === 0) break;

        // Process each product
        for (const prod of pageProducts) {
          const normName = normalise(prod.name);
          if (normName.length < 3) continue;

          const existing = productLookup.get(normName);

          if (existing) {
            // Update image if missing
            if (!existing.image_url && prod.imageUrl) {
              await sql`UPDATE cs_products SET image_url = ${prod.imageUrl} WHERE id = ${existing.id}`;
              existing.image_url = prod.imageUrl;
              catImgUpdate++;
              stats.updatedImages++;
            }
            // Update CGars price URL if we have one
            if (prod.url) {
              const updated = await sql`
                UPDATE cs_prices SET url = ${prod.url} 
                WHERE product_id = ${existing.id} AND retailer = 'C.Gars Ltd'
                AND (url IS NULL OR url != ${prod.url})
              `;
              if (updated.length > 0) { catUrlUpdate++; stats.updatedUrls++; }
            }
          } else {
            // New product - add it
            const brand = extractBrand(prod.name);
            const cleanName = prod.name
              .replace(/\s*-\s*(1 Single|Single)$/i, '')
              .replace(/\s*Cigar\s*$/i, '')
              .trim();
            
            const result = await sql`
              INSERT INTO cs_products (name, brand, image_url, min_price, max_price, retailer_count)
              VALUES (${cleanName}, ${brand}, ${prod.imageUrl}, ${prod.price}, ${prod.price}, 1)
              RETURNING id
            `;
            const newId = result[0].id;
            
            // Add CGars price
            await sql`
              INSERT INTO cs_prices (product_id, retailer, price, url, source_name)
              VALUES (${newId}, ${'C.Gars Ltd'}, ${prod.price}, ${prod.url}, ${prod.name})
            `;
            
            // Add to lookup so we don't duplicate
            productLookup.set(normName, { id: newId, name: cleanName, brand, image_url: prod.imageUrl });
            catNew++;
            stats.newProducts++;
            stats.newPrices++;
          }
        }

        // Next page
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
        await page.waitForTimeout(PAGE_DELAY);

        // Clear references to help GC
        if (pageNum % 5 === 0 && global.gc) global.gc();
      }

      console.log(`  [${completedSet.size + 1}] ${label}: +${catNew} new, +${catImgUpdate} images, +${catUrlUpdate} URLs${pageNum > 1 ? ` (${pageNum} pages)` : ''}`);
    } catch (e) {
      console.log(`  ⚠️ ${label}: ${e.message.slice(0, 80)}`);
    }

    // Mark complete and save progress every category
    progress.completedCats.push(catPath);
    completedSet.add(catPath);
    saveProgress(progress);
    
    await page.waitForTimeout(300 + Math.random() * 300);
  }

  await browser.close();

  // Final stats
  const final = await sql`
    SELECT COUNT(*) as total, COUNT(image_url) FILTER (WHERE image_url IS NOT NULL) as with_img FROM cs_products
  `;
  const pct = Math.round((final[0].with_img / final[0].total) * 100);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Done! New products: ${stats.newProducts} | Updated images: ${stats.updatedImages} | Updated URLs: ${stats.updatedUrls}`);
  console.log(`📊 Coverage: ${final[0].with_img}/${final[0].total} (${pct}%)`);
  console.log(`${completedSet.size === categoryUrls.length ? '🏁 All categories complete!' : `⏳ ${categoryUrls.length - completedSet.size} categories remaining - run again to continue`}`);
}

scrape().catch(e => { console.error(e); process.exit(1); });
