const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  // How many products have images?
  const withImg = await sql`SELECT count(*) as cnt FROM cs_products WHERE image_url IS NOT NULL AND image_url != ''`;
  const total = await sql`SELECT count(*) as cnt FROM cs_products`;
  console.log(`Products with images: ${withImg[0].cnt} / ${total[0].cnt}`);

  // Products still with dirty names
  const dirty = await sql`SELECT count(*) as cnt FROM cs_products WHERE name ~ '(Cigar|Single|Cuban|Tubed|Pack of)' `;
  console.log(`Products with dirty names: ${dirty[0].cnt}`);
  
  // Sample dirty names
  const samples = await sql`SELECT id, name FROM cs_products WHERE name ~ '(Cigar.-.1|Single|Tubed)' LIMIT 10`;
  samples.forEach(s => console.log(`  id=${s.id} "${s.name}"`));

  // How many products have only 1 retailer but could have more?
  // Check: products where name matches other products in different retailer price sets
  console.log('\nRetailer distribution:');
  const dist = await sql`SELECT retailer_count, count(*) as cnt FROM cs_products GROUP BY retailer_count ORDER BY retailer_count DESC`;
  dist.forEach(d => console.log(`  ${d.retailer_count} retailers: ${d.cnt} products`));

  // Top multi-retailer products to verify
  console.log('\nTop 5 multi-retailer products:');
  const top = await sql`SELECT p.id, p.name, p.retailer_count, p.min_price, p.max_price, p.image_url FROM cs_products p ORDER BY p.retailer_count DESC, p.name LIMIT 5`;
  for (const t of top) {
    console.log(`\n  "${t.name}" (${t.retailer_count} retailers, £${t.min_price}-${t.max_price}, img: ${t.image_url ? 'YES' : 'NO'})`);
    const prices = await sql`SELECT retailer, price, url FROM cs_prices WHERE product_id = ${t.id}`;
    prices.forEach(p => console.log(`    ${p.retailer}: £${p.price} | ${p.url}`));
  }
})();
