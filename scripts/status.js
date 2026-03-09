const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function status() {
  const total = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const withImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  const noImg = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count > 1`;
  const dupPrices = await sql`
    SELECT COUNT(*) as c FROM (
      SELECT product_id, retailer, price, COUNT(*) as cnt 
      FROM cs_prices GROUP BY product_id, retailer, price HAVING COUNT(*) > 1
    ) dups
  `;

  console.log('Products:', total[0].c);
  console.log('With images:', withImg[0].c, '(' + Math.round(withImg[0].c / total[0].c * 100) + '%)');
  console.log('Without images:', noImg[0].c);
  console.log('Multi-retailer:', multi[0].c);
  console.log('Duplicate price entries:', dupPrices[0].c);

  const topMissing = await sql`
    SELECT brand, COUNT(*) as c FROM cs_products 
    WHERE image_url IS NULL OR image_url = '' 
    GROUP BY brand ORDER BY c DESC LIMIT 10
  `;
  console.log('\nTop brands missing images:');
  topMissing.forEach(r => console.log('  ' + r.brand + ': ' + r.c));
}
status().catch(console.error);
