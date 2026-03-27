const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '').replace(/^[^:]+:\s*/i, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

async function findDupes() {
  // Look at all products and find ones with very similar normalised names
  const products = await sql`SELECT id, name, brand FROM cs_products ORDER BY name`;
  console.log(`Total products: ${products.length}\n`);
  
  // Check specific example: Diplomaticos
  const diplo = products.filter(p => p.name.toLowerCase().includes('diplomaticos'));
  console.log('=== DIPLOMATICOS ===');
  for (const d of diplo) {
    const prices = await sql`SELECT retailer, price FROM cs_prices WHERE product_id = ${d.id}`;
    console.log(`  ID ${d.id}: "${d.name}" (${prices.length} prices)`);
    prices.forEach(p => console.log(`    ${p.retailer}: £${p.price}`));
    console.log(`    normalised: "${normalise(d.name)}"`);
  }
  
  // Find ALL potential duplicates by grouping similar normalised names
  const normMap = new Map(); // norm -> [products]
  for (const p of products) {
    const norm = normalise(p.name);
    if (!normMap.has(norm)) normMap.set(norm, []);
    normMap.get(norm).push(p);
  }
  
  // Find groups with >1 product (exact normalised duplicates)
  const exactDupes = [];
  for (const [norm, group] of normMap) {
    if (group.length > 1) exactDupes.push({ norm, products: group });
  }
  
  console.log(`\n=== EXACT NORMALISED DUPLICATES: ${exactDupes.length} groups ===`);
  exactDupes.slice(0, 20).forEach(g => {
    console.log(`\n  "${g.norm}":`);
    g.products.forEach(p => console.log(`    ID ${p.id}: "${p.name}"`));
  });
  
  // Count total products that are duplicates
  const totalDupeProducts = exactDupes.reduce((sum, g) => sum + g.products.length - 1, 0);
  console.log(`\n📊 ${exactDupes.length} duplicate groups, ${totalDupeProducts} extra products to merge`);
}

findDupes().catch(console.error);
