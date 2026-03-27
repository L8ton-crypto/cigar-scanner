/**
 * Find and merge duplicate products that should be the same cigar.
 * More aggressive normalisation than the seed script uses.
 */
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getDb() { return neon(process.env.DATABASE_URL); }

function aggressiveNorm(name) {
  return name.toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\bcigar[s]?\b/gi, '')
    .replace(/\bsingle\b/gi, '')
    .replace(/\bcuban\b/gi, '')
    .replace(/\b1\b/g, '') // remove lone "1" (from "1 Single")
    .replace(/\bems\b/gi, '')
    .replace(/\bhavana\b/gi, '')
    .replace(/\btin of \d+/gi, '')
    .replace(/\bbox of \d+/gi, '')
    .replace(/\bbag of \d+/gi, '')
    .replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '')
    .replace(/\bbundle of \d+/gi, '')
    .replace(/\btubed?\b/gi, '')
    .replace(/\b\(.*?\)/g, '') // remove parenthetical content
    .replace(/no\s*\.?\s*(\d)/g, 'no$1') // "no. 2" / "no 2" / "no.2" → "no2"
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  let sql = getDb();
  const products = await sql`SELECT id, name, brand, image_url FROM cs_products ORDER BY id`;
  console.log(`Total products: ${products.length}\n`);
  
  // Group by aggressive normalised name
  const groups = new Map();
  for (const p of products) {
    const norm = aggressiveNorm(p.name);
    if (!groups.has(norm)) groups.set(norm, []);
    groups.get(norm).push(p);
  }
  
  // Find groups with >1 product, splitting box/pack variants from singles
  const dupeGroups = [];
  for (const [norm, group] of groups) {
    if (group.length > 1) {
      // Split into sub-groups: singles vs boxes/packs/tins/bundles
      const singles = group.filter(p => !/box of \d|bundle of \d|pack of \d|tin of \d|cabinet of \d/i.test(p.name));
      const boxes = group.filter(p => /box of \d|bundle of \d|pack of \d|tin of \d|cabinet of \d/i.test(p.name));
      
      if (singles.length > 1) dupeGroups.push({ norm: norm + ' [single]', products: singles });
      if (boxes.length > 1) dupeGroups.push({ norm: norm + ' [box]', products: boxes });
    }
  }
  
  console.log(`Found ${dupeGroups.length} duplicate groups to merge\n`);
  
  // Show first 20
  dupeGroups.slice(0, 20).forEach(g => {
    console.log(`"${g.norm}":`);
    g.products.forEach(p => console.log(`  ID ${p.id}: "${p.name}" ${p.image_url ? '📷' : '❌'}`));
  });
  
  if (dupeGroups.length === 0) {
    console.log('No duplicates found!');
    return;
  }
  
  // Merge: keep the product with the best image, move all prices to it, delete the rest
  console.log(`\n🔄 Merging ${dupeGroups.length} groups...`);
  let merged = 0;
  
  for (const group of dupeGroups) {
    // Pick the "keeper" - prefer one with an image, then lowest ID
    const keeper = group.products.sort((a, b) => {
      const aImg = a.image_url && a.image_url.length > 5 ? 1 : 0;
      const bImg = b.image_url && b.image_url.length > 5 ? 1 : 0;
      if (bImg !== aImg) return bImg - aImg; // prefer with image
      return a.id - b.id; // then lowest ID
    })[0];
    
    const toDelete = group.products.filter(p => p.id !== keeper.id);
    
    for (const dup of toDelete) {
      sql = getDb();
      // Move prices from dup to keeper
      await sql`UPDATE cs_prices SET product_id = ${keeper.id} WHERE product_id = ${dup.id}`;
      // Delete the duplicate product
      await sql`DELETE FROM cs_products WHERE id = ${dup.id}`;
      merged++;
    }
  }
  
  console.log(`   Merged ${merged} duplicate products`);
  
  // Remove any resulting duplicate prices (same product_id + retailer)
  console.log('🧹 Removing duplicate prices...');
  sql = getDb();
  await sql`DELETE FROM cs_prices WHERE id NOT IN (SELECT MIN(id) FROM cs_prices GROUP BY product_id, retailer)`;
  
  // Remove orphaned products
  sql = getDb();
  await sql`DELETE FROM cs_products WHERE id NOT IN (SELECT DISTINCT product_id FROM cs_prices)`;
  
  // Update aggregates
  console.log('🔄 Updating aggregates...');
  sql = getDb();
  await sql`
    UPDATE cs_products SET min_price = sub.min_p, max_price = sub.max_p, retailer_count = sub.cnt
    FROM (SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt FROM cs_prices GROUP BY product_id) sub
    WHERE cs_products.id = sub.product_id
  `;
  
  // Final check
  console.log('\n📊 After merge:');
  sql = getDb();
  const prodCount = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const priceCount = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  const retailers = await sql`SELECT retailer, COUNT(*) as c FROM cs_prices GROUP BY retailer ORDER BY c DESC`;
  const multi = await sql`SELECT COUNT(*) as c FROM cs_products WHERE retailer_count >= 2`;
  const noImage = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  
  console.log(`   Products: ${prodCount[0].c}`);
  console.log(`   Prices: ${priceCount[0].c}`);
  console.log(`   Multi-retailer: ${multi[0].c}`);
  console.log(`   Missing images: ${noImage[0].c}`);
  retailers.forEach(r => console.log(`   ${r.retailer}: ${r.c}`));
  
  // Verify Diplomaticos
  console.log('\n🔍 Diplomaticos check:');
  sql = getDb();
  const diplo = await sql`SELECT id, name, retailer_count FROM cs_products WHERE name ILIKE '%diplomaticos%'`;
  for (const d of diplo) {
    const prices = await sql`SELECT retailer, price FROM cs_prices WHERE product_id = ${d.id}`;
    console.log(`   "${d.name}" — ${prices.length} retailers`);
    prices.forEach(p => console.log(`      ${p.retailer}: £${p.price}`));
  }
}

main().catch(console.error);
