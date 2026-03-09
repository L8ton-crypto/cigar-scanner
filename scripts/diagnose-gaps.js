const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // Missing images breakdown
  const missing = await sql`
    SELECT p.brand, COUNT(*) as c 
    FROM cs_products p WHERE p.image_url IS NULL 
    GROUP BY p.brand ORDER BY c DESC
  `;
  const totalMissing = missing.reduce((s, m) => s + Number(m.c), 0);
  console.log(`=== Missing Images: ${totalMissing} ===`);
  missing.forEach(m => console.log(`  ${m.brand}: ${m.c}`));

  // Which retailers do missing-image products come from?
  const missingByRetailer = await sql`
    SELECT pr.retailer, COUNT(DISTINCT p.id) as products
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL
    GROUP BY pr.retailer ORDER BY products DESC
  `;
  console.log('\nMissing images by retailer source:');
  missingByRetailer.forEach(r => console.log(`  ${r.retailer}: ${r.products}`));

  // How many missing-image products are CGars-only vs multi-retailer?
  const missingMulti = await sql`
    SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL AND retailer_count > 1
  `;
  console.log(`\nMissing & multi-retailer: ${missingMulti[0].c}`);

  // Sample missing products
  const samples = await sql`
    SELECT p.name, p.brand, pr.retailer, pr.url
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL
    ORDER BY RANDOM() LIMIT 15
  `;
  console.log('\nSample missing:');
  samples.forEach(s => console.log(`  [${s.retailer}] ${s.brand} - ${s.name}\n    ${s.url || 'NO URL'}`));

  // Broken URLs check - sample CGars URLs
  console.log('\n=== URL Status ===');
  const totalUrls = await sql`SELECT COUNT(*) as c FROM cs_prices WHERE url IS NOT NULL`;
  const noUrls = await sql`SELECT COUNT(*) as c FROM cs_prices WHERE url IS NULL`;
  console.log(`Prices with URLs: ${totalUrls[0].c}`);
  console.log(`Prices without URLs: ${noUrls[0].c}`);
  
  // Check for obviously old CGars URL format
  const oldFormat = await sql`
    SELECT COUNT(*) as c FROM cs_prices 
    WHERE retailer = 'C.Gars Ltd' AND url LIKE '%c-317_101_%'
  `;
  const newFormat = await sql`
    SELECT COUNT(*) as c FROM cs_prices 
    WHERE retailer = 'C.Gars Ltd' AND url LIKE '%c-317_44_%'
  `;
  const aspFormat = await sql`
    SELECT COUNT(*) as c FROM cs_prices 
    WHERE retailer = 'C.Gars Ltd' AND url LIKE '%-p.asp'
  `;
  console.log(`\nCGars URL formats:`);
  console.log(`  Old format (c-317_101_): ${oldFormat[0].c}`);
  console.log(`  New format (c-317_44_): ${newFormat[0].c}`);  
  console.log(`  Product pages (-p.asp): ${aspFormat[0].c}`);

  // Check other retailers
  const otherUrls = await sql`
    SELECT retailer, COUNT(*) as total,
      COUNT(*) FILTER (WHERE url IS NOT NULL) as with_url
    FROM cs_prices GROUP BY retailer
  `;
  console.log('\nURL coverage by retailer:');
  otherUrls.forEach(r => console.log(`  ${r.retailer}: ${r.with_url}/${r.total} have URLs`));
})();
