const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);
const search = process.argv[2] || 'aladino connecticut santi';

(async () => {
  const p = await sql`SELECT * FROM cs_products WHERE lower(name) LIKE ${'%' + search.toLowerCase() + '%'}`;
  console.log(`Found ${p.length} products matching "${search}":\n`);
  for (const prod of p) {
    console.log(`${prod.name}`);
    console.log(`  ID: ${prod.id} | ${prod.retailer_count} retailers | £${prod.min_price}-${prod.max_price}`);
    console.log(`  Image: ${prod.image_url || '(none)'}`);
    const pr = await sql`SELECT retailer, price, url FROM cs_prices WHERE product_id = ${prod.id} ORDER BY price`;
    pr.forEach(r => console.log(`  ${r.retailer}: £${r.price} → ${r.url}`));
    console.log('');
  }
})();
