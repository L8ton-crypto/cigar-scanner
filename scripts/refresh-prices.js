#!/usr/bin/env node
/**
 * CigarScanner Price Refresh Engine
 * Re-scrapes all retailers, compares with DB, logs changes.
 * 
 * Usage:
 *   node refresh-prices.js              # All API-based retailers
 *   node refresh-prices.js --retailer=GQ  # Single retailer
 *   node refresh-prices.js --browser     # Include browser-based retailers
 *   node refresh-prices.js --dry-run     # Compare only, don't write
 * 
 * API-based (fast): GQ Tobaccos, House of Cigars, Sautter, Rebellion, Turmeaus, Smoke King
 * Browser-based (slow): C.Gars Ltd, Havana House
 */
const { neon } = require('@neondatabase/serverless');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);
const RUN_ID = `refresh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_BROWSER = args.includes('--browser');
const SINGLE_RETAILER = args.find(a => a.startsWith('--retailer='))?.split('=')[1];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '-').replace(/&mdash;/g, '-').replace(/&pound;/g, '£');
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
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': options.json ? 'application/json' : 'text/html',
        ...options.headers
      }
    };
    const req = https.get(reqOpts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (options.json) {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ============================================================
// RETAILER SCRAPERS
// ============================================================

async function scrapeGQ() {
  const brandPages = [
    'bolivar', 'cohiba', 'cuaba', 'diplomaticos', 'el-rey-del-mundo',
    'fonseca', 'guantanamera', 'h-upmann', 'hoyo-de-monterrey',
    'jose-l-piedra', 'juan-lopez', 'la-gloria-cubana', 'montecristo',
    'partagas', 'por-larranaga', 'punch', 'quai-dorsay', 'quintero',
    'rafael-gonzalez', 'ramon-allones', 'romeo-y-julieta',
    'saint-luis-rey', 'san-cristobal-de-la-habana', 'sancho-panza',
    'trinidad', 'vegas-robaina', 'vegueros',
    'a-j-fernandez', 'aladino', 'alec-bradley', 'arturo-fuente',
    'avo', 'brick-house', 'camacho', 'cao', 'casa-turrent',
    'charatan', 'chinchalero', 'davidoff', 'drew-estate',
    'flor-de-selva', 'foundation-cigars', 'gurkha', 'inka-secret-blend',
    'joya-de-nicaragua', 'kristoff', 'la-aurora', 'la-flor-dominicana',
    'la-invicta', 'macanudo', 'my-father', 'nub-cigars', 'oliva',
    'oscar-valladares', 'padron', 'perdomo', 'plasencia',
    'quorum', 'regius', 'rocky-patel', 'tatuaje', 'vegafina',
    'ritmeester', 'villiger-cigars', 'hamlet-cigars',
    'henri-wintermans-cigars', 'conquistador', 'mitchellero',
    'puffin-cigars', 'two-smoking-barrels', 'meerapfel',
  ];

  const products = [];
  for (const brand of brandPages) {
    let page = 1;
    while (true) {
      const url = page === 1
        ? `https://www.gqtobaccos.com/${brand}/`
        : `https://www.gqtobaccos.com/${brand}/?page=${page}`;
      
      const html = await httpGet(url);
      if (!html) break;

      // Extract products
      const imgRegex = /class="card-figure"[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g;
      const pageProducts = [];
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const name = decodeEntities(match[2]).trim();
        if (!name || name.length < 3) continue;
        pageProducts.push({ name, imageUrl: match[1], price: null, url: null });
      }

      // Get prices
      const priceRegex = /class="price[^"]*"[^>]*>\s*£([\d,.]+)/g;
      let i = 0;
      while ((match = priceRegex.exec(html)) !== null && i < pageProducts.length) {
        pageProducts[i].price = parseFloat(match[1].replace(',', ''));
        i++;
      }

      // Get URLs
      const urlRegex = /class="card-figure"[\s\S]*?<a[^>]*href="([^"]+)"/g;
      i = 0;
      while ((match = urlRegex.exec(html)) !== null && i < pageProducts.length) {
        pageProducts[i].url = match[1];
        i++;
      }

      products.push(...pageProducts);

      // Check for more pages
      const maxPageMatch = html.match(/Page \d+ of (\d+)/);
      const maxPage = maxPageMatch ? parseInt(maxPageMatch[1]) : 1;
      if (page >= maxPage) break;
      page++;
      await sleep(300);
    }
    await sleep(200);
  }

  return products.map(p => ({
    name: p.name,
    price: p.price,
    url: p.url,
    retailer: 'GQ Tobaccos',
    retailerUrl: 'https://www.gqtobaccos.com'
  }));
}

async function scrapeHouseOfCigars() {
  return scrapeWooCommerce(
    'https://www.thehouseofcigars.co.uk',
    'House of Cigars',
    'https://www.thehouseofcigars.co.uk'
  );
}

async function scrapeSautter() {
  const EXCLUDED_CATEGORIES = [
    'Accessories', 'Ashtrays', 'Candles', 'Cutters', 'Lighters', 'Humidors',
    'Cases', 'Pouches', 'Lifestyle', 'Art', 'Books', 'Writing', 'Clothing',
    'Private Purchases', 'Spirits', 'Whisky', 'Rum', 'Gin', 'Wine',
    'Coffee', 'Chocolate', 'Gift Sets', 'Vouchers', 'Membership'
  ];

  return scrapeWooCommerce(
    'https://www.sauttercigars.com',
    'Sautter',
    'https://www.sauttercigars.com',
    (product) => {
      const cats = (product.categories || []).map(c => c.name);
      return !cats.every(name =>
        EXCLUDED_CATEGORIES.some(exc => name.toLowerCase().includes(exc.toLowerCase()))
      );
    }
  );
}

async function scrapeWooCommerce(baseUrl, retailerName, retailerUrl, filter = null) {
  const products = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${baseUrl}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
    const data = await httpGet(url, { json: true });
    if (!data || data.length === 0) break;

    for (const p of data) {
      if (filter && !filter(p)) continue;
      const name = decodeEntities(p.name);
      const price = p.prices?.price
        ? parseInt(p.prices.price) / Math.pow(10, p.prices.currency_minor_unit || 2)
        : null;
      
      if (!price) continue;
      products.push({
        name,
        price,
        url: p.permalink,
        retailer: retailerName,
        retailerUrl
      });
    }

    if (data.length < perPage) break;
    page++;
    await sleep(800);
  }

  return products;
}

async function scrapeRebellion() {
  const products = [];
  const seen = new Set();
  let page = 1;

  while (true) {
    const html = await httpGet(`https://www.rebellioncigars.co.uk/search/products?keywords=&page=${page}`);
    if (!html) break;

    // Match full-URL pattern (site returns absolute URLs now)
    const regex = /item-heading"><a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>[\s\S]*?<span class="price">\s*&pound;([\d,.]+)/g;
    let match;
    let found = 0;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (seen.has(url)) continue; // Dedupe grid/list views
      seen.add(url);
      const name = decodeEntities(match[2].trim());
      const price = parseFloat(match[3].replace(',', ''));
      if (price > 0) {
        products.push({ name, price, url, retailer: 'Rebellion', retailerUrl: 'https://www.rebellioncigars.co.uk' });
        found++;
      }
    }

    if (found === 0) break;
    page++;
    await sleep(500);
  }

  return products;
}

async function scrapeTurmeaus() {
  const products = [];
  let page = 1;
  let consecutiveEmpty = 0;

  while (consecutiveEmpty < 2) {
    const html = await httpGet(`https://www.turmeaus.co.uk/all_products.php?page=${page}`);
    if (!html) { consecutiveEmpty++; page++; continue; }

    const regex = /<div class="product-name"><a href="([^"]+)">([^<]+)<\/a><\/div>[\s\S]*?(?:<span class="new_price">£([\d,.]+)<\/span>|<span class="now_price">Online Price: <strong>£([\d,.]+)<\/strong>)/g;
    let match;
    let found = 0;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const name = decodeEntities(match[2].trim());
      const price = parseFloat((match[3] || match[4]).replace(',', ''));
      if (price > 0 && isCigar(name)) {
        products.push({ name, price, url, retailer: 'Turmeaus', retailerUrl: 'https://www.turmeaus.co.uk' });
        found++;
      }
    }

    if (found === 0) { consecutiveEmpty++; } else { consecutiveEmpty = 0; }
    page++;
    await sleep(300);
  }

  return products;
}

function isCigar(name) {
  const lower = name.toLowerCase();
  if (lower.includes('pipe tobacco') || lower.includes('rolling tobacco')) return false;
  if (lower.includes('whisky') || lower.includes('whiskey') || lower.includes('bourbon') || 
      lower.includes('rum ') || lower.includes('gin ') || lower.includes('vodka') ||
      lower.includes('brandy') || lower.includes('cognac') || lower.includes('wine')) return false;
  if (lower.includes('hip flask') || lower.includes('cufflink') || lower.includes('keyring') ||
      lower.includes('decanter') || lower.includes('glass set') || lower.includes('tumbler')) return false;
  if (lower.match(/\bpipe\b/) && !lower.includes('cigar')) return false;
  if (lower.includes('snuff') || lower.includes('chewing tobacco')) return false;
  if (lower.includes('cigar') || lower.includes('corona') || lower.includes('robusto') ||
      lower.includes('churchill') || lower.includes('torpedo') || lower.includes('toro') ||
      lower.includes('lancero') || lower.includes('belicoso') || lower.includes('lonsdale') ||
      lower.includes('habano') || lower.includes('maduro') || lower.includes('connecticut') ||
      lower.includes('sampler') || lower.includes('humidor')) return true;
  return false;
}

// Smoke King uses Shopify JSON API
async function smokingKingScraper() {
  const products = [];
  let page = 1;

  while (true) {
    const data = await httpGet(`https://www.smoke-king.co.uk/collections/cigars/products.json?limit=250&page=${page}`, { json: true });
    if (!data || !data.products || data.products.length === 0) break;

    for (const p of data.products) {
      const price = p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null;
      if (!price) continue;
      products.push({
        name: p.title,
        price,
        url: `https://www.smoke-king.co.uk/products/${p.handle}`,
        retailer: 'Smoke King',
        retailerUrl: 'https://www.smoke-king.co.uk'
      });
    }

    if (data.products.length < 250) break;
    page++;
    await sleep(500);
  }

  return products;
}

// ============================================================
// PRICE COMPARISON ENGINE
// ============================================================

async function loadExistingPrices(retailerName) {
  const prices = await sql`
    SELECT p.id as price_id, p.product_id, p.price, p.url, p.source_name,
           pr.name as product_name
    FROM cs_prices p
    JOIN cs_products pr ON pr.id = p.product_id
    WHERE p.retailer = ${retailerName}
  `;
  
  // Build lookup by normalised source name
  const lookup = new Map();
  for (const p of prices) {
    const key = normalise(p.source_name || p.product_name);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(p);
  }
  return { prices, lookup };
}

async function compareAndUpdate(retailerName, scrapedProducts, stats) {
  const { prices: existingPrices, lookup } = await loadExistingPrices(retailerName);
  const now = new Date();
  const seenPriceIds = new Set();
  
  // Batch operations to avoid connection exhaustion
  const priceUpdates = [];
  const verifyUpdates = [];
  const changeInserts = [];
  
  for (const scraped of scrapedProducts) {
    const key = normalise(scraped.name);
    const matches = lookup.get(key) || [];
    
    if (matches.length > 0) {
      const existing = matches[0];
      seenPriceIds.add(existing.price_id);
      
      const oldPrice = parseFloat(existing.price);
      const newPrice = scraped.price;
      
      if (Math.abs(oldPrice - newPrice) > 0.01) {
        stats.pricesUpdated++;
        priceUpdates.push({ id: existing.price_id, price: newPrice });
        changeInserts.push({ productId: existing.product_id, oldPrice, newPrice, type: 'price_change' });
      } else {
        verifyUpdates.push(existing.price_id);
      }
      stats.productsVerified++;
    }
  }
  
  // Execute batched writes
  if (!DRY_RUN) {
    // Batch price updates in chunks of 50
    for (let i = 0; i < priceUpdates.length; i += 50) {
      const batch = priceUpdates.slice(i, i + 50);
      for (const u of batch) {
        try {
          await sql`UPDATE cs_prices SET price = ${u.price}, scraped_at = ${now}, last_verified = ${now} WHERE id = ${u.id}`;
        } catch (e) { console.log(`  ⚠️  Update err: ${e.message.substring(0, 60)}`); }
      }
    }
    
    // Batch verify updates in chunks of 100
    for (let i = 0; i < verifyUpdates.length; i += 100) {
      const ids = verifyUpdates.slice(i, i + 100);
      try {
        await sql`UPDATE cs_prices SET last_verified = ${now} WHERE id = ANY(${ids})`;
      } catch (e) { console.log(`  ⚠️  Verify err: ${e.message.substring(0, 60)}`); }
    }
    
    // Batch change inserts
    for (const c of changeInserts) {
      try {
        await sql`INSERT INTO cs_price_changes (product_id, retailer, old_price, new_price, change_type, changed_at)
                  VALUES (${c.productId}, ${retailerName}, ${c.oldPrice}, ${c.newPrice}, ${c.type}, ${now})`;
      } catch (e) { /* ignore individual insert errors */ }
    }
  }
  
  // Mark prices NOT seen in scrape as potentially removed
  const unseenPrices = existingPrices.filter(p => !seenPriceIds.has(p.price_id));
  stats.potentialRemovals = unseenPrices.length;
  
  // Don't auto-remove - just log. If >50% missing, the scrape probably failed.
  if (!DRY_RUN && unseenPrices.length > 0 && unseenPrices.length < existingPrices.length * 0.5) {
    for (const removed of unseenPrices) {
      try {
        await sql`INSERT INTO cs_price_changes (product_id, retailer, old_price, new_price, change_type, changed_at)
                  VALUES (${removed.product_id}, ${retailerName}, ${removed.price}, ${null}, 'potential_removal', ${now})`;
      } catch (e) { /* ignore */ }
    }
  }
  
  return stats;
}

async function recalcProductAggregates() {
  console.log('\n⬆️  Recalculating min/max prices and retailer counts...');
  if (!DRY_RUN) {
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
  }
  console.log('✅ Aggregates recalculated');
}

// ============================================================
// MAIN
// ============================================================

const RETAILERS = {
  'GQ': { name: 'GQ Tobaccos', scrape: scrapeGQ },
  'House of Cigars': { name: 'House of Cigars', scrape: scrapeHouseOfCigars },
  'Sautter': { name: 'Sautter', scrape: scrapeSautter },
  'Rebellion': { name: 'Rebellion', scrape: scrapeRebellion },
  'Turmeaus': { name: 'Turmeaus', scrape: scrapeTurmeaus },
  'Smoke King': { name: 'Smoke King', scrape: smokingKingScraper },
};

async function refreshRetailer(key, retailer) {
  const startTime = Date.now();
  const stats = { productsScraped: 0, productsVerified: 0, pricesUpdated: 0, potentialRemovals: 0, errors: [] };
  
  console.log(`\n🔄 Refreshing ${retailer.name}...`);
  
  // Log start
  let logId;
  if (!DRY_RUN) {
    const rows = await sql`
      INSERT INTO cs_scrape_log (run_id, retailer, status)
      VALUES (${RUN_ID}, ${retailer.name}, 'running')
      RETURNING id
    `;
    logId = rows[0].id;
  }
  
  try {
    const products = await retailer.scrape();
    stats.productsScraped = products.length;
    console.log(`   Scraped ${products.length} products`);
    
    if (products.length === 0) {
      stats.errors.push('No products scraped - possible site issue');
      console.log(`   ⚠️  No products found! Skipping comparison.`);
    } else {
      await compareAndUpdate(retailer.name, products, stats);
      console.log(`   ✅ Verified: ${stats.productsVerified}, Updated: ${stats.pricesUpdated}, Potential removals: ${stats.potentialRemovals}`);
    }
  } catch (err) {
    stats.errors.push(err.message);
    console.log(`   ❌ Error: ${err.message}`);
  }
  
  const duration = Date.now() - startTime;
  
  // Log completion
  if (!DRY_RUN && logId) {
    await sql`
      UPDATE cs_scrape_log SET
        completed_at = NOW(),
        status = ${stats.errors.length > 0 ? 'error' : 'success'},
        products_scraped = ${stats.productsScraped},
        prices_updated = ${stats.pricesUpdated},
        prices_removed = ${stats.potentialRemovals},
        errors = ${stats.errors.length > 0 ? stats.errors : null},
        duration_ms = ${duration}
      WHERE id = ${logId}
    `;
  }
  
  return stats;
}

async function main() {
  console.log('🔄 CigarScanner Price Refresh');
  console.log(`   Run ID: ${RUN_ID}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  
  const totalStart = Date.now();
  const allStats = {};
  
  for (const [key, retailer] of Object.entries(RETAILERS)) {
    if (SINGLE_RETAILER && !key.toLowerCase().includes(SINGLE_RETAILER.toLowerCase())) {
      continue;
    }
    allStats[retailer.name] = await refreshRetailer(key, retailer);
  }
  
  // Recalculate aggregates if any prices changed
  const totalUpdated = Object.values(allStats).reduce((sum, s) => sum + s.pricesUpdated, 0);
  if (totalUpdated > 0) {
    await recalcProductAggregates();
  }
  
  // Summary
  const totalDuration = Date.now() - totalStart;
  console.log('\n' + '='.repeat(60));
  console.log('📊 REFRESH SUMMARY');
  console.log('='.repeat(60));
  
  let totalScraped = 0, totalVerified = 0, totalChanges = 0, totalRemovals = 0;
  for (const [name, stats] of Object.entries(allStats)) {
    const status = stats.errors.length > 0 ? '❌' : '✅';
    console.log(`${status} ${name}: scraped=${stats.productsScraped}, verified=${stats.productsVerified}, changed=${stats.pricesUpdated}, removals=${stats.potentialRemovals}`);
    totalScraped += stats.productsScraped;
    totalVerified += stats.productsVerified;
    totalChanges += stats.pricesUpdated;
    totalRemovals += stats.potentialRemovals;
  }
  
  console.log(`\n📈 Totals: ${totalScraped} scraped, ${totalVerified} verified, ${totalChanges} price changes, ${totalRemovals} potential removals`);
  console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - no changes were written to the database');
  }
}

process.on('unhandledRejection', (e) => console.error('⚠️  Unhandled rejection:', e?.message || e));
main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
