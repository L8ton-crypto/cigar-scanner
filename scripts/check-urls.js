const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const samples = await sql`
    SELECT name, image_url FROM cs_cigars 
    WHERE image_url IS NOT NULL AND image_url != '' 
    ORDER BY RANDOM() LIMIT 10
  `;
  samples.forEach(c => {
    console.log(c.name);
    console.log('  ' + c.image_url);
    console.log();
  });
}
check().catch(console.error);
