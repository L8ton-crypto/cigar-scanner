const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const total = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const noImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  console.log('Total products:', total[0].c);
  console.log('With images:', withImg[0].c);
  console.log('Missing images:', noImg[0].c);
  
  const byRetailer = await sql`
    SELECT pr.retailer, COUNT(DISTINCT p.id) as missing 
    FROM cs_products p 
    JOIN cs_prices pr ON pr.product_id = p.id 
    WHERE (p.image_url IS NULL OR p.image_url = '') 
    GROUP BY pr.retailer ORDER BY missing DESC
  `;
  console.log('\nMissing images by retailer:');
  byRetailer.forEach(r => console.log(' ', r.retailer, ':', r.missing));

  // Check how many missing-image products have another retailer that DOES have an image
  const crossMatch = await sql`
    SELECT COUNT(DISTINCT p.id) as c
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE (p.image_url IS NULL OR p.image_url = '')
  `;
  
  // Products that are ONLY from turmeaus (no other retailer)
  const turmeausOnly = await sql`
    SELECT COUNT(*) as c FROM cs_products p
    WHERE (p.image_url IS NULL OR p.image_url = '')
    AND NOT EXISTS (
      SELECT 1 FROM cs_prices pr WHERE pr.product_id = p.id AND pr.retailer != 'Turmeaus'
    )
  `;
  console.log('\nTurmeaus-only (no cross-retailer match):', turmeausOnly[0].c);

  // Sample missing
  const samples = await sql`
    SELECT p.id, p.name, p.brand, array_agg(DISTINCT pr.retailer) as retailers
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE (p.image_url IS NULL OR p.image_url = '')
    GROUP BY p.id, p.name, p.brand
    ORDER BY RANDOM()
    LIMIT 10
  `;
  console.log('\nSample missing-image products:');
  samples.forEach(s => console.log(' ', s.brand, '-', s.name, '| retailers:', s.retailers.join(', ')));
})();
