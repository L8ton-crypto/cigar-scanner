const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function check() {
  // Check for HTML in descriptions
  const htmlDescs = await sql`
    SELECT id, name, retailer, substring(description, 1, 300) as desc_preview
    FROM cs_cigars 
    WHERE description LIKE '%<%>%' OR description LIKE '%&amp;%' OR description LIKE '%&lt;%'
    LIMIT 10
  `;
  
  console.log(`Entries with HTML in description: checking...`);
  
  const count = await sql`
    SELECT COUNT(*) as c FROM cs_cigars 
    WHERE description LIKE '%<%>%' OR description LIKE '%&amp;%' OR description LIKE '%&lt;%'
  `;
  console.log(`Total with HTML entities/tags: ${count[0].c}`);
  
  htmlDescs.forEach(r => {
    console.log(`\nID ${r.id} [${r.retailer}] ${r.name}`);
    console.log(`  "${r.desc_preview}"`);
  });
}
check().catch(console.error);
