const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function clean() {
  // Fix HTML entities in descriptions
  console.log('Cleaning HTML entities from descriptions...');
  
  // &amp; -> &
  let r1 = await sql`UPDATE cs_cigars SET description = REPLACE(description, '&amp;', '&') WHERE description LIKE '%&amp;%'`;
  console.log('Fixed &amp; entities');
  
  // &lt; -> <  and &gt; -> >
  await sql`UPDATE cs_cigars SET description = REPLACE(description, '&lt;', '<') WHERE description LIKE '%&lt;%'`;
  await sql`UPDATE cs_cigars SET description = REPLACE(description, '&gt;', '>') WHERE description LIKE '%&gt;%'`;
  console.log('Fixed &lt; &gt; entities');
  
  // &quot; -> "
  await sql`UPDATE cs_cigars SET description = REPLACE(description, '&quot;', '"') WHERE description LIKE '%&quot;%'`;
  console.log('Fixed &quot; entities');
  
  // &#39; -> '
  await sql`UPDATE cs_cigars SET description = REPLACE(description, '&#39;', '''') WHERE description LIKE '%&#39;%'`;
  console.log('Fixed &#39; entities');
  
  // &nbsp; -> space
  await sql`UPDATE cs_cigars SET description = REPLACE(description, '&nbsp;', ' ') WHERE description LIKE '%&nbsp;%'`;
  console.log('Fixed &nbsp; entities');

  // Strip any remaining HTML tags (e.g. <br>, <p>, <span>)
  // Use regex replace to strip tags
  await sql`UPDATE cs_cigars SET description = REGEXP_REPLACE(description, '<[^>]+>', '', 'g') WHERE description ~ '<[^>]+>'`;
  console.log('Stripped remaining HTML tags');

  // Also clean names
  await sql`UPDATE cs_cigars SET name = REPLACE(name, '&amp;', '&') WHERE name LIKE '%&amp;%'`;
  console.log('Fixed &amp; in names');

  // Check result
  const remaining = await sql`
    SELECT COUNT(*) as c FROM cs_cigars 
    WHERE description LIKE '%&amp;%' OR description LIKE '%&lt;%' OR description ~ '<[^>]+>'
  `;
  console.log('\nRemaining entries with HTML: ' + remaining[0].c);
  console.log('Done!');
}
clean().catch(console.error);
