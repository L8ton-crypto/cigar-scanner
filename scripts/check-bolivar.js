const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

(async () => {
  const products = await sql`SELECT id, name, image_url FROM cs_products WHERE name ILIKE '%bolivar%gold%medal%'`;
  for (const p of products) {
    console.log(`ID ${p.id}: "${p.name}"`);
    console.log(`  Image: ${p.image_url}`);
    const prices = await sql`SELECT retailer, url FROM cs_prices WHERE product_id = ${p.id}`;
    prices.forEach(pr => console.log(`  ${pr.retailer}: ${pr.url}`));
    console.log('');
  }
  
  // Also check a sample of images to see if they look wrong
  console.log('--- Sample of recently fixed images (C.Gars only products) ---');
  const samples = await sql`
    SELECT p.id, p.name, p.image_url 
    FROM cs_products p
    WHERE p.image_url LIKE '%cgarsltd%'
    ORDER BY RANDOM()
    LIMIT 10
  `;
  samples.forEach(s => {
    console.log(`ID ${s.id}: "${s.name}"`);
    console.log(`  ${s.image_url}`);
  });
})();
