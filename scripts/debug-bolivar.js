const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  // All Bolivar products in DB
  const bolivars = await sql`
    SELECT p.id, p.name, p.brand, p.image_url,
      (SELECT string_agg(pr.source_name, ' | ') FROM cs_prices pr WHERE pr.product_id = p.id) as sources
    FROM cs_products p
    WHERE p.brand ILIKE '%Bolivar%' OR p.name ILIKE '%Bolivar%'
    ORDER BY p.name
  `;
  
  console.log(`Bolivar products in DB: ${bolivars.length}\n`);
  for (const b of bolivars) {
    const img = b.image_url ? '✅' : '❌';
    console.log(`${img} [${b.id}] ${b.name}`);
    console.log(`   Sources: ${b.sources}`);
    if (b.image_url) console.log(`   Image: ${b.image_url}`);
    console.log();
  }
})();
