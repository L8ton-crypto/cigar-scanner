const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // C.Gars products missing images that have another retailer
  const fixable = await sql`
    SELECT COUNT(DISTINCT p.id) as c
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.retailer = 'C.Gars Ltd'
    AND EXISTS (
      SELECT 1 FROM cs_prices pr2 WHERE pr2.product_id = p.id AND pr2.retailer != 'C.Gars Ltd'
    )
  `;
  console.log('C.Gars missing-image with cross-retailer match:', fixable[0].c);

  // C.Gars-only missing images
  const cgarsOnly = await sql`
    SELECT COUNT(*) as c FROM cs_products p
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND EXISTS (SELECT 1 FROM cs_prices WHERE product_id = p.id AND retailer = 'C.Gars Ltd')
    AND NOT EXISTS (SELECT 1 FROM cs_prices WHERE product_id = p.id AND retailer != 'C.Gars Ltd')
  `;
  console.log('C.Gars-only (no other retailer):', cgarsOnly[0].c);

  // Check: did the C.Gars scraper just never grab images?
  const cgarsTotal = await sql`
    SELECT COUNT(DISTINCT product_id) as c FROM cs_prices WHERE retailer = 'C.Gars Ltd'
  `;
  const cgarsWithImg = await sql`
    SELECT COUNT(*) as c FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE pr.retailer = 'C.Gars Ltd'
    AND p.image_url IS NOT NULL AND p.image_url != ''
  `;
  console.log('\nC.Gars total products:', cgarsTotal[0].c);
  console.log('C.Gars products WITH images:', cgarsWithImg[0].c);
  console.log('(images likely came from other retailers)');
  
  // Sample C.Gars product page URLs to check for images
  const samples = await sql`
    SELECT p.id, p.name, pr.url
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND pr.retailer = 'C.Gars Ltd'
    ORDER BY RANDOM()
    LIMIT 5
  `;
  console.log('\nSample C.Gars URLs to check:');
  samples.forEach(s => console.log(' ', s.name, '\n   ', s.url));
})();
