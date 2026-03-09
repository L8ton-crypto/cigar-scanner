const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function fix() {
  // 1. Fix min/max: only use the LOWEST price per retailer (which should be the single)
  // If a product's max_price is 10x+ the min_price, cap it
  console.log('1. Fixing extreme price ranges...');
  
  const extreme = await sql`
    SELECT id, name, min_price, max_price FROM cs_products 
    WHERE max_price > min_price * 5 AND retailer_count > 1
  `;
  console.log('   Products with >5x price spread:', extreme.length);
  
  for (const p of extreme) {
    // Get only the cheapest price per retailer (likely the single)
    const cheapest = await sql`
      SELECT MIN(price) as price FROM cs_prices 
      WHERE product_id = ${p.id}
      GROUP BY retailer
      ORDER BY price ASC
    `;
    if (cheapest.length > 0) {
      const min = Number(cheapest[0].price);
      const max = Number(cheapest[cheapest.length - 1].price);
      await sql`UPDATE cs_products SET min_price = ${min}, max_price = ${max} WHERE id = ${p.id}`;
    }
  }
  console.log('   Fixed', extreme.length, 'products');

  // 2. Show corrected top savings
  const topSavings = await sql`
    SELECT name, brand, min_price, max_price, retailer_count,
           (max_price - min_price) as savings
    FROM cs_products 
    WHERE retailer_count > 1 AND max_price > min_price AND max_price < min_price * 3
    ORDER BY savings DESC LIMIT 10
  `;
  console.log('\n🏆 Top savings (corrected):');
  topSavings.forEach(p => {
    console.log('   ' + p.brand + ' ' + p.name + ': £' + Number(p.min_price).toFixed(2) + '-£' + Number(p.max_price).toFixed(2) + ' (save £' + Number(p.savings).toFixed(2) + ')');
  });
  
  console.log('\nDone!');
}

fix().catch(e => { console.error(e); process.exit(1); });
