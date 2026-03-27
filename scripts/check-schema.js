const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('Tables:', tables.map(t => t.table_name));
  
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cs_cigars' ORDER BY ordinal_position`;
  console.log('\ncs_cigars columns:');
  cols.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
  
  const priceCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cs_prices' ORDER BY ordinal_position`;
  if (priceCols.length) {
    console.log('\ncs_prices columns:');
    priceCols.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
    
    const priceSample = await sql`SELECT * FROM cs_prices LIMIT 3`;
    console.log('\nPrice sample:', JSON.stringify(priceSample, null, 2));
    
    const priceStats = await sql`SELECT retailer, COUNT(*) as total FROM cs_prices GROUP BY retailer ORDER BY total DESC`;
    console.log('\nPrice counts by retailer:', priceStats);
  }
  
  // Check how products relate to prices
  const sample = await sql`SELECT id, name, brand, retailer FROM cs_cigars WHERE brand = 'Oliva' LIMIT 5`;
  console.log('\nOliva samples from cs_cigars:', sample);
  
  const olivaPrices = await sql`SELECT * FROM cs_prices WHERE cigar_id IN (SELECT id FROM cs_cigars WHERE brand = 'Oliva') LIMIT 5`;
  console.log('\nOliva prices from cs_prices:', olivaPrices);
}
check().catch(console.error);
