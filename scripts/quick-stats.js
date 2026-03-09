const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const r = await sql`SELECT COUNT(*) as total, COUNT(image_url) FILTER (WHERE image_url IS NOT NULL) as with_img FROM cs_products`;
  const pct = Math.round((r[0].with_img / r[0].total) * 100);
  console.log(`Coverage: ${r[0].with_img}/${r[0].total} (${pct}%)`);
  const m = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL`;
  console.log(`Still missing: ${m[0].c}`);
})();
