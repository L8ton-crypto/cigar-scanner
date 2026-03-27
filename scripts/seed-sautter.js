const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/&#\d+;/g, '')
    .replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\bcigar[s]?\b/gi, '')
    .replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '')
    .replace(/\bbox of \d+/gi, '')
    .replace(/\bbag of \d+/gi, '')
    .replace(/\bpack of \d+/gi, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(a, b) {
  if (a === b) return 1.0;
  const wordsA = a.split(' ');
  const wordsB = b.split(' ');
  let matches = 0;
  for (const w of wordsA) {
    if (w.length >= 3 && wordsB.includes(w)) matches++;
  }
  return matches / Math.max(wordsA.length, wordsB.length);
}

async function seedSautter() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sautter-data.json'), 'utf8'));
  console.log(`🏪 Sautter: ${data.length} products to process\n`);

  // Clean previous Sautter data
  const oldPrices = await sql`SELECT COUNT(*) as c FROM cs_prices WHERE retailer = 'Sautter'`;
  if (parseInt(oldPrices[0].c) > 0) {
    console.log(`🗑️  Removing ${oldPrices[0].c} existing Sautter prices...`);
    await sql`DELETE FROM cs_prices WHERE retailer = 'Sautter'`;
  }

  // Load existing canonical products
  const existing = await sql`SELECT id, name, brand FROM cs_products`;
  console.log(`📦 ${existing.length} canonical products to match against\n`);
  
  const normLookup = existing.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    norm: normalise(p.name)
  }));

  let matched = 0;
  let newProducts = 0;
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    if (!p.name || !p.price) { skipped++; continue; }

    const normName = normalise(p.name);
    
    // Find best match in cs_products
    let bestMatch = null;
    let bestScore = 0;
    
    for (const ex of normLookup) {
      const score = matchScore(normName, ex.norm);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ex;
      }
    }

    let productId;

    if (bestScore >= 0.7 && bestMatch) {
      productId = bestMatch.id;
      matched++;
      if (matched <= 5) {
        console.log(`  ✅ MATCH (${(bestScore * 100).toFixed(0)}%): "${p.name.substring(0, 55)}" → "${bestMatch.name.substring(0, 45)}"`);
      }
    } else {
      // Create new canonical product in cs_products
      const result = await sql`
        INSERT INTO cs_products (
          name, brand, description, image_url, format,
          min_price, max_price, retailer_count, created_at
        ) VALUES (
          ${p.name}, ${p.brand}, ${''},
          ${p.imageUrl}, ${p.format},
          ${p.price}, ${p.price}, ${1},
          ${new Date()}
        ) RETURNING id
      `;
      productId = result[0].id;
      newProducts++;
      
      normLookup.push({ id: productId, name: p.name, brand: p.brand, norm: normName });
      
      if (newProducts <= 5) {
        console.log(`  🆕 NEW: "${p.name.substring(0, 60)}" (best was ${(bestScore * 100).toFixed(0)}%${bestMatch ? ': "' + bestMatch.name.substring(0, 40) + '"' : ''})`);
      }
    }

    // Insert price into cs_prices
    await sql`
      INSERT INTO cs_prices (
        product_id, retailer, retailer_url, price, currency,
        available, url, source_name, source_id, scraped_at
      ) VALUES (
        ${productId}, ${'Sautter'}, ${'https://www.sauttercigars.com'},
        ${p.price}, ${'GBP'},
        ${p.inStock !== false}, ${p.url}, ${p.name}, ${'sautter-' + p.wooId},
        ${new Date()}
      )
    `;

    if ((matched + newProducts) % 100 === 0) {
      console.log(`  ... processed ${matched + newProducts + skipped}/${data.length}`);
    }
  }

  // Update min_price, max_price, retailer_count on all products
  console.log('\n🔄 Updating price ranges...');
  await sql`
    UPDATE cs_products SET
      min_price = sub.min_p,
      max_price = sub.max_p,
      retailer_count = sub.cnt
    FROM (
      SELECT product_id, MIN(price) as min_p, MAX(price) as max_p, COUNT(DISTINCT retailer) as cnt
      FROM cs_prices
      GROUP BY product_id
    ) sub
    WHERE cs_products.id = sub.product_id
  `;

  console.log(`\n📊 Results:`);
  console.log(`   Matched to existing: ${matched}`);
  console.log(`   New products created: ${newProducts}`);
  console.log(`   Skipped: ${skipped}`);

  const priceStats = await sql`SELECT retailer, COUNT(*) as total FROM cs_prices GROUP BY retailer ORDER BY total DESC`;
  console.log('\n💰 Price entries by retailer:');
  priceStats.forEach(s => console.log(`   ${s.retailer}: ${s.total}`));

  const productStats = await sql`SELECT COUNT(*) as total FROM cs_products`;
  console.log(`\n📦 Total canonical products: ${productStats[0].total}`);
  
  // Show some multi-retailer examples for Sautter
  const multiRetailer = await sql`
    SELECT p.name, p.min_price, p.max_price, p.retailer_count
    FROM cs_products p
    JOIN cs_prices pr ON p.id = pr.product_id AND pr.retailer = 'Sautter'
    WHERE p.retailer_count > 1
    ORDER BY p.retailer_count DESC
    LIMIT 5
  `;
  if (multiRetailer.length) {
    console.log('\n🔍 Multi-retailer matches (Sautter + others):');
    multiRetailer.forEach(r => console.log(`   ${r.name}: £${r.min_price}-£${r.max_price} (${r.retailer_count} retailers)`));
  }
}

seedSautter().catch(console.error);
