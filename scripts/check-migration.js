const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const products = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const prices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const oldCigars = await sql`SELECT COUNT(*) as c FROM cs_cigars WHERE available = true`;
  
  console.log('Old cs_cigars (available):', oldCigars[0].c);
  console.log('New cs_products:', products[0].c);
  console.log('New cs_prices:', prices[0].c);
  
  if (parseInt(products[0].c) > 0) {
    const stats = await sql`
      SELECT COUNT(*) as total,
        COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image,
        COUNT(*) FILTER (WHERE retailer_count > 1) as multi,
        COUNT(DISTINCT brand) as brands,
        AVG(retailer_count) as avg_ret
      FROM cs_products
    `;
    const s = stats[0];
    console.log('\nProducts:', s.total);
    console.log('With images:', s.with_image);
    console.log('Multi-retailer:', s.multi);
    console.log('Brands:', s.brands);
    console.log('Avg retailers:', Number(s.avg_ret).toFixed(2));
  }
}
check().catch(console.error);
