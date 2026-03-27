const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');

(async () => {
  // First: show the Diplomaticos No.2 case
  console.log('=== DIPLOMATICOS NO.2 CASE ===');
  const diplo = await sql`SELECT id, name, brand, retailer_count FROM cs_products WHERE lower(name) LIKE '%diplomatico%' AND lower(name) LIKE '%no%2%' ORDER BY name`;
  diplo.forEach(d => console.log(`  id=${d.id} "${d.name}" brand="${d.brand}" retailers=${d.retailer_count}`));
  
  // Show their prices
  for (const d of diplo) {
    const prices = await sql`SELECT retailer, price FROM cs_prices WHERE product_id = ${d.id}`;
    prices.forEach(p => console.log(`    -> ${p.retailer}: £${p.price}`));
  }

  // Now find ALL near-duplicates using normalized names
  console.log('\n=== FINDING NEAR-DUPLICATE PRODUCTS ===');
  
  // Strategy: normalize names by lowercasing, removing extra spaces, standardizing common patterns
  const allProducts = await sql`SELECT id, name, brand FROM cs_products ORDER BY name`;
  
  function normalize(name) {
    return name
      .toLowerCase()
      .replace(/[''`´]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/\bno\.\s*/g, 'no.')
      .replace(/\bno\s+(\d)/g, 'no.$1')
      .replace(/\bnumber\s+(\d)/g, 'no.$1')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s*–\s*/g, ' ')
      .replace(/\s*—\s*/g, ' ')
      .replace(/cigars?$/i, '')
      .replace(/\btubed?\b/gi, '')
      .replace(/\btubo\b/gi, '')
      .replace(/\bsingle\b/gi, '')
      .replace(/\beach\b/gi, '')
      .replace(/\bper cigar\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Group by normalized name
  const groups = {};
  for (const p of allProducts) {
    const key = normalize(p.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const dupeGroups = Object.entries(groups).filter(([_, items]) => items.length > 1);
  console.log(`Found ${dupeGroups.length} duplicate groups\n`);

  // Show all groups
  let totalDupeProducts = 0;
  for (const [normName, items] of dupeGroups.sort((a, b) => b[1].length - a[1].length)) {
    totalDupeProducts += items.length - 1; // extras beyond the canonical one
    console.log(`[${items.length}x] "${normName}"`);
    for (const item of items) {
      const prices = await sql`SELECT retailer, price FROM cs_prices WHERE product_id = ${item.id}`;
      const priceStr = prices.map(p => `${p.retailer}:£${p.price}`).join(', ');
      console.log(`  id=${item.id} "${item.name}" | ${priceStr || 'no prices'}`);
    }
    console.log('');
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total duplicate groups: ${dupeGroups.length}`);
  console.log(`Total extra products to merge: ${totalDupeProducts}`);
  console.log(`Total products currently: ${allProducts.length}`);
  console.log(`After merge: ~${allProducts.length - totalDupeProducts}`);
})();
