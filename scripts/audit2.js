const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  // cs_cigars by retailer
  console.log('=== CS_CIGARS BY RETAILER ===');
  const cigRetailers = await sql`SELECT retailer, count(*) as cnt FROM cs_cigars GROUP BY retailer ORDER BY cnt DESC`;
  cigRetailers.forEach(c => console.log(`${c.retailer || 'NULL'}: ${c.cnt}`));

  // Duplicate prices detail
  console.log('\n=== ALL DUPLICATE PRICES (same product + retailer) ===');
  const dupPrices = await sql`SELECT product_id, retailer, count(*) as cnt FROM cs_prices GROUP BY product_id, retailer HAVING count(*) > 1 ORDER BY cnt DESC`;
  console.log(`Total duplicate combos: ${dupPrices.length}`);
  const totalDupRows = dupPrices.reduce((sum, d) => sum + parseInt(d.cnt), 0);
  const removableRows = dupPrices.reduce((sum, d) => sum + parseInt(d.cnt) - 1, 0);
  console.log(`Total rows in duplicates: ${totalDupRows}`);
  console.log(`Removable rows (keeping latest): ${removableRows}`);

  // Products with no prices at all
  console.log('\n=== PRODUCTS WITH NO PRICES ===');
  const noPrices = await sql`SELECT count(*) as cnt FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  console.log(`Products with 0 prices: ${noPrices[0].cnt}`);

  // retailer_count accuracy
  console.log('\n=== RETAILER_COUNT MISMATCHES ===');
  const mismatches = await sql`
    SELECT p.id, p.name, p.retailer_count as stored, count(DISTINCT pr.retailer) as actual 
    FROM cs_products p 
    LEFT JOIN cs_prices pr ON pr.product_id = p.id 
    GROUP BY p.id, p.name, p.retailer_count 
    HAVING p.retailer_count IS DISTINCT FROM count(DISTINCT pr.retailer) 
    LIMIT 20`;
  console.log(`${mismatches.length} mismatches`);
  mismatches.slice(0, 5).forEach(m => console.log(`  "${m.name}": stored=${m.stored} actual=${m.actual}`));

  // min_price / max_price accuracy  
  console.log('\n=== MIN/MAX PRICE MISMATCHES ===');
  const priceMismatches = await sql`
    SELECT p.id, p.name, p.min_price as stored_min, p.max_price as stored_max,
           min(pr.price) as actual_min, max(pr.price) as actual_max
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    GROUP BY p.id, p.name, p.min_price, p.max_price
    HAVING p.min_price IS DISTINCT FROM min(pr.price) OR p.max_price IS DISTINCT FROM max(pr.price)
    LIMIT 10`;
  console.log(`${priceMismatches.length}+ mismatches`);
  priceMismatches.slice(0, 3).forEach(m => console.log(`  "${m.name}": stored=${m.stored_min}-${m.stored_max} actual=${m.actual_min}-${m.actual_max}`));

  // Products missing brand  
  console.log('\n=== PRODUCTS WITH EMPTY BRAND ===');
  const noBrand = await sql`SELECT count(*) as cnt FROM cs_products WHERE brand = '' OR brand IS NULL`;
  console.log(noBrand[0].cnt);

  // Products missing description
  console.log('\n=== PRODUCTS WITH NO DESCRIPTION ===');
  const noDesc = await sql`SELECT count(*) as cnt FROM cs_products WHERE description IS NULL OR description = ''`;
  console.log(noDesc[0].cnt);

  // Prices with null price
  console.log('\n=== PRICES WITH NULL PRICE ===');
  const nullPrice = await sql`SELECT count(*) as cnt FROM cs_prices WHERE price IS NULL`;
  console.log(nullPrice[0].cnt);

  // Sample cs_cigars
  console.log('\n=== SAMPLE CS_CIGARS (3) ===');
  const sampleC = await sql`SELECT id, name, brand, price, retailer FROM cs_cigars LIMIT 3`;
  sampleC.forEach(s => console.log(JSON.stringify(s)));
  
  // cs_cigars: how many have been matched to products?
  console.log('\n=== CS_CIGARS vs CS_PRODUCTS OVERLAP ===');
  const overlap = await sql`SELECT count(*) as cnt FROM cs_cigars c WHERE EXISTS (SELECT 1 FROM cs_products p WHERE lower(p.name) = lower(c.name))`;
  const totalCigars = await sql`SELECT count(*) as cnt FROM cs_cigars`;
  console.log(`cs_cigars matched to cs_products by name: ${overlap[0].cnt} / ${totalCigars[0].cnt}`);
})();
