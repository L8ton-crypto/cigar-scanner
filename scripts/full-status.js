const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // Overall stats
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL`;
  const multiRetailer = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count > 1`;
  
  console.log('=== CigarScanner Status ===');
  console.log(`Products: ${products[0].c}`);
  console.log(`Prices: ${prices[0].c}`);
  console.log(`With images: ${withImg[0].c}/${products[0].c} (${Math.round(withImg[0].c/products[0].c*100)}%)`);
  console.log(`Multi-retailer: ${multiRetailer[0].c}`);

  // Missing images breakdown
  const missingByBrand = await sql`
    SELECT brand, COUNT(*) as c FROM cs_products 
    WHERE image_url IS NULL GROUP BY brand ORDER BY c DESC LIMIT 10
  `;
  console.log('\n--- Missing images (top 10 brands) ---');
  missingByBrand.forEach(b => console.log(`  ${b.brand}: ${b.c}`));

  // Retailers
  const retailers = await sql`
    SELECT retailer, COUNT(*) as prices, COUNT(DISTINCT product_id) as products
    FROM cs_prices GROUP BY retailer ORDER BY prices DESC
  `;
  console.log('\n--- Retailers ---');
  retailers.forEach(r => console.log(`  ${r.retailer}: ${r.products} products, ${r.prices} prices`));

  // Broken URLs (404 CGars URLs we know about)
  const cgarsUrls = await sql`
    SELECT COUNT(*) as c FROM cs_prices WHERE retailer = 'C.Gars Ltd' AND url IS NOT NULL
  `;
  console.log(`\n--- CGars URLs: ${cgarsUrls[0].c} ---`);

  // Products with no prices at all
  const noPrices = await sql`
    SELECT COUNT(*) as c FROM cs_products p 
    WHERE NOT EXISTS (SELECT 1 FROM cs_prices pr WHERE pr.product_id = p.id)
  `;
  console.log(`Products with NO prices: ${noPrices[0].c}`);

  // Price range sanity
  const suspicious = await sql`
    SELECT COUNT(*) as c FROM cs_prices WHERE price > 500
  `;
  const vSuspicious = await sql`
    SELECT COUNT(*) as c FROM cs_prices WHERE price > 1000
  `;
  console.log(`\n--- Price sanity ---`);
  console.log(`Prices > £500: ${suspicious[0].c}`);
  console.log(`Prices > £1000: ${vSuspicious[0].c}`);

  // Sample high prices
  const highPrices = await sql`
    SELECT p.name, pr.price, pr.retailer, pr.source_name
    FROM cs_prices pr JOIN cs_products p ON p.id = pr.product_id
    WHERE pr.price > 500 ORDER BY pr.price DESC LIMIT 10
  `;
  if (highPrices.length > 0) {
    console.log('Top 10 highest prices:');
    highPrices.forEach(h => console.log(`  £${Number(h.price).toFixed(2)} - ${h.name} (${h.retailer})`));
  }

  // Duplicate product check
  const dupes = await sql`
    SELECT LOWER(name) as lname, COUNT(*) as c 
    FROM cs_products GROUP BY LOWER(name) HAVING COUNT(*) > 1
    ORDER BY c DESC LIMIT 10
  `;
  console.log(`\n--- Potential duplicates ---`);
  console.log(`Product names appearing more than once: ${dupes.length}`);
  dupes.slice(0, 5).forEach(d => console.log(`  "${d.lname}" x${d.c}`));
})();
