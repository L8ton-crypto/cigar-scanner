const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  // Schema
  console.log('=== SCHEMA ===');
  for (const t of ['cs_products', 'cs_prices', 'cs_cigars']) {
    const cols = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ${t} ORDER BY ordinal_position`;
    console.log(`\n${t}:`);
    cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`));
  }

  // Counts
  console.log('\n=== ROW COUNTS ===');
  for (const t of ['cs_products', 'cs_prices', 'cs_cigars', 'cs_scans', 'cs_alerts']) {
    const r = await sql.query(`SELECT count(*) as cnt FROM ${t}`).catch(e => [{cnt: 'ERR'}]);
    console.log(`${t}: ${r[0].cnt}`);
  }

  // Prices by retailer
  console.log('\n=== PRICES BY RETAILER ===');
  const retailers = await sql`SELECT retailer, count(*) as cnt, round(avg(price)::numeric, 2) as avg_price FROM cs_prices GROUP BY retailer ORDER BY cnt DESC`;
  retailers.forEach(r => console.log(`${r.retailer}: ${r.cnt} prices, avg £${r.avg_price}`));

  // Product dupes by name
  console.log('\n=== PRODUCT DUPES (exact name match) ===');
  const dupes = await sql`SELECT name, count(*) as cnt FROM cs_products GROUP BY name HAVING count(*) > 1 ORDER BY cnt DESC LIMIT 20`;
  console.log(`${dupes.length} duplicate names found`);
  dupes.slice(0, 10).forEach(d => console.log(`  ${d.cnt}x "${d.name}"`));

  // Orphaned prices
  console.log('\n=== ORPHANED PRICES ===');
  const orphaned = await sql`SELECT count(*) as cnt FROM cs_prices WHERE product_id NOT IN (SELECT id FROM cs_products)`;
  console.log(`Orphaned: ${orphaned[0].cnt}`);

  // Duplicate prices (same product + retailer)
  console.log('\n=== DUPLICATE PRICES (same product + retailer) ===');
  const dupPrices = await sql`SELECT product_id, retailer, count(*) as cnt FROM cs_prices GROUP BY product_id, retailer HAVING count(*) > 1 ORDER BY cnt DESC LIMIT 10`;
  console.log(`${dupPrices.length} duplicate combos`);
  dupPrices.slice(0, 5).forEach(d => console.log(`  product_id=${d.product_id} ${d.retailer}: ${d.cnt}x`));

  // cs_cigars - what's in there
  console.log('\n=== CS_CIGARS BY SOURCE ===');
  const cigSources = await sql`SELECT source, count(*) as cnt FROM cs_cigars GROUP BY source ORDER BY cnt DESC`;
  cigSources.forEach(c => console.log(`${c.source || 'NULL'}: ${c.cnt}`));
  if (!cigSources.length) console.log('Empty');

  // Products with missing key fields
  console.log('\n=== PRODUCTS WITH MISSING FIELDS ===');
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'cs_products'`;
  const colNames = cols.map(c => c.column_name);
  console.log('Columns:', colNames.join(', '));
  
  // Check nulls for key columns
  for (const col of ['name', 'brand', 'category']) {
    if (colNames.includes(col)) {
      const r = await sql.query(`SELECT count(*) as cnt FROM cs_products WHERE ${col} IS NULL OR ${col} = ''`);
      if (parseInt(r[0].cnt) > 0) console.log(`  ${col}: ${r[0].cnt} missing`);
    }
  }

  // Sample products
  console.log('\n=== SAMPLE PRODUCTS (5) ===');
  const sample = await sql`SELECT * FROM cs_products LIMIT 5`;
  sample.forEach(s => console.log(JSON.stringify(s)));

  // Sample prices
  console.log('\n=== SAMPLE PRICES (5) ===');
  const sampleP = await sql`SELECT * FROM cs_prices LIMIT 5`;
  sampleP.forEach(s => console.log(JSON.stringify(s)));

  // Sample cs_cigars
  console.log('\n=== SAMPLE CS_CIGARS (5) ===');
  const sampleC = await sql`SELECT * FROM cs_cigars LIMIT 5`;
  sampleC.forEach(s => console.log(JSON.stringify(s)));
})();
