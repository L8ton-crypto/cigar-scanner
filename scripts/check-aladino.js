const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  const products = await sql`SELECT * FROM cs_products WHERE lower(name) LIKE '%aladino%connecticut%santi%'`;
  console.log('PRODUCTS:', products.length);
  products.forEach(p => console.log(JSON.stringify(p, null, 2)));

  for (const p of products) {
    const prices = await sql`SELECT * FROM cs_prices WHERE product_id = ${p.id}`;
    console.log(`\nPRICES for id=${p.id} "${p.name}":`);
    prices.forEach(pr => console.log(JSON.stringify(pr, null, 2)));
  }
})();
