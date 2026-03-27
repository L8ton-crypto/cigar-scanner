const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  // cs_products schema
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cs_products' ORDER BY ordinal_position`;
  console.log('cs_products columns:');
  cols.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
  
  // Sample
  const sample = await sql`SELECT * FROM cs_products WHERE name ILIKE '%oliva%' LIMIT 3`;
  console.log('\nOliva from cs_products:', JSON.stringify(sample, null, 2));
  
  // Count
  const count = await sql`SELECT COUNT(*) as total FROM cs_products`;
  console.log('\nTotal cs_products:', count[0].total);
  
  // How prices link
  const fk = await sql`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'cs_prices' AND tc.constraint_type = 'FOREIGN KEY'
  `;
  console.log('\ncs_prices foreign keys:', fk);
}
check().catch(console.error);
