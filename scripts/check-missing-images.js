const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const missing = await sql`SELECT COUNT(*) as total FROM cs_products WHERE image_url IS NULL`;
  const withCgars = await sql`
    SELECT COUNT(DISTINCT p.id) as c
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL AND pr.retailer = 'C.Gars Ltd'
  `;
  const samples = await sql`
    SELECT p.id, p.name, p.brand, pr.url
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL AND pr.retailer = 'C.Gars Ltd'
    ORDER BY RANDOM()
    LIMIT 5
  `;
  console.log('Missing images total:', missing[0].total);
  console.log('Missing images with CGars listing:', withCgars[0].c);
  console.log('\nSample CGars URLs:');
  samples.forEach(s => console.log(' ', s.brand, s.name, '\n   ', s.url));
})();
