const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const stats = await sql`
    SELECT retailer, COUNT(*) as total, 
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars GROUP BY retailer
  `;
  console.log('Image coverage:');
  for (const s of stats) {
    const pct = Math.round((s.with_image / s.total) * 100);
    console.log(`  ${s.retailer}: ${s.with_image}/${s.total} (${pct}%)`);
  }
}
check().catch(console.error);
