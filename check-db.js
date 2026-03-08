const {neon}=require('@neondatabase/serverless');
const sql=neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  const count = await sql`SELECT count(*) as c FROM cs_cigars`;
  console.log('Cigars in DB:', count[0].c);
  const brands = await sql`SELECT count(DISTINCT brand) as c FROM cs_cigars`;
  console.log('Brands:', brands[0].c);
  const sample = await sql`SELECT name, brand, price FROM cs_cigars ORDER BY RANDOM() LIMIT 3`;
  console.log('Sample:');
  sample.forEach(c => console.log(`  ${c.brand} - ${c.name}: £${c.price}`));
}
check();
