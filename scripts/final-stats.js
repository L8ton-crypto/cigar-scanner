const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function stats() {
  const overall = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image,
      COUNT(DISTINCT brand) as brands
    FROM cs_cigars WHERE available = true
  `;

  const byRetailer = await sql`
    SELECT retailer, COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars GROUP BY retailer ORDER BY total DESC
  `;

  console.log('Overall:');
  console.log('  Total:', overall[0].total, 'available cigars');
  console.log('  With images:', overall[0].with_image, '(' + Math.round(overall[0].with_image / overall[0].total * 100) + '%)');
  console.log('  Brands:', overall[0].brands);
  console.log('\nBy retailer:');
  byRetailer.forEach(r => {
    const pct = Math.round(r.with_image / r.total * 100);
    console.log('  ' + r.retailer + ': ' + r.with_image + '/' + r.total + ' (' + pct + '%)');
  });
}
stats().catch(console.error);
