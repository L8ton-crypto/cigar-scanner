const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const r = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL`;
  console.log('Missing images:', r[0].c);
  
  // Sample by brand
  const brands = await sql`
    SELECT brand, COUNT(*) as c 
    FROM cs_products WHERE image_url IS NULL 
    GROUP BY brand ORDER BY c DESC LIMIT 20
  `;
  console.log('\nBy brand:');
  brands.forEach(b => console.log(`  ${b.brand}: ${b.c}`));
  
  // Sample some names
  const samples = await sql`
    SELECT name, brand FROM cs_products WHERE image_url IS NULL ORDER BY name LIMIT 40
  `;
  console.log('\nSample missing:');
  samples.forEach(s => console.log(`  [${s.brand}] ${s.name}`));
})();
