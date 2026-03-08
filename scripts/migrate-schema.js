/**
 * Migrate from flat cs_cigars to normalised cs_products + cs_prices.
 * 
 * 1. Create new tables
 * 2. Deduplicate cigars into canonical products
 * 3. Link prices from each retailer
 * 4. Pick best image per product
 */

const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('🔄 Starting schema migration...\n');

  // Step 1: Create new tables
  console.log('📋 Creating new tables...');
  
  await sql`DROP TABLE IF EXISTS cs_prices`;
  await sql`DROP TABLE IF EXISTS cs_products`;

  await sql`
    CREATE TABLE cs_products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      format TEXT,
      strength TEXT,
      country TEXT,
      length_mm INTEGER,
      ring_gauge INTEGER,
      min_price DECIMAL(10,2),
      max_price DECIMAL(10,2),
      retailer_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE cs_prices (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES cs_products(id) ON DELETE CASCADE,
      retailer TEXT NOT NULL,
      retailer_url TEXT,
      price DECIMAL(10,2),
      original_price DECIMAL(10,2),
      currency TEXT DEFAULT 'GBP',
      available BOOLEAN DEFAULT true,
      url TEXT,
      source_name TEXT,
      source_id TEXT,
      scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX idx_cs_products_brand ON cs_products(brand)`;
  await sql`CREATE INDEX idx_cs_products_strength ON cs_products(strength)`;
  await sql`CREATE INDEX idx_cs_products_min_price ON cs_products(min_price)`;
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    await sql`CREATE INDEX idx_cs_products_name_trgm ON cs_products USING gin(name gin_trgm_ops)`;
  } catch (e) {
    console.log('   (trigram index skipped - pg_trgm not available)');
  }
  await sql`CREATE INDEX idx_cs_prices_product_id ON cs_prices(product_id)`;
  await sql`CREATE INDEX idx_cs_prices_retailer ON cs_prices(retailer)`;

  console.log('✅ Tables created\n');

  // Step 2: Load all existing data
  console.log('📦 Loading existing data...');
  const allCigars = await sql`
    SELECT id, name, brand, description, price, original_price, currency,
           available, url, image_url, retailer, retailer_url, category,
           format, strength, country, length_mm, ring_gauge, source_id, scraped_at
    FROM cs_cigars
    WHERE available = true
    ORDER BY brand, name
  `;
  console.log(`   ${allCigars.length} available cigars loaded\n`);

  // Step 3: Deduplicate into canonical products
  console.log('🔍 Deduplicating...');
  
  // Group by canonical key
  const groups = new Map(); // canonical key -> [cigar rows]
  
  for (const cigar of allCigars) {
    const key = canonicalKey(cigar.name, cigar.brand);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cigar);
  }

  console.log(`   ${allCigars.length} rows -> ${groups.size} canonical products\n`);

  // Step 4: Insert products and prices
  console.log('⬆️  Inserting products + prices...');
  let productCount = 0;
  let priceCount = 0;

  for (const [key, cigars] of groups) {
    // Pick the best data for the canonical product
    const product = buildCanonicalProduct(cigars);
    
    // Insert product
    const result = await sql`
      INSERT INTO cs_products (name, brand, description, image_url, format, strength, country, length_mm, ring_gauge, min_price, max_price, retailer_count)
      VALUES (${product.name}, ${product.brand}, ${product.description}, ${product.image_url},
              ${product.format}, ${product.strength}, ${product.country},
              ${product.length_mm}, ${product.ring_gauge},
              ${product.min_price}, ${product.max_price}, ${product.retailer_count})
      RETURNING id
    `;
    const productId = result[0].id;
    productCount++;

    // Insert prices (one per retailer, deduplicated)
    const retailerPrices = deduplicateRetailerPrices(cigars);
    for (const price of retailerPrices) {
      await sql`
        INSERT INTO cs_prices (product_id, retailer, retailer_url, price, original_price, currency, available, url, source_name, source_id, scraped_at)
        VALUES (${productId}, ${price.retailer}, ${price.retailer_url}, ${price.price}, ${price.original_price},
                ${price.currency}, ${price.available}, ${price.url}, ${price.source_name}, ${price.source_id},
                ${price.scraped_at ? new Date(price.scraped_at) : new Date()})
      `;
      priceCount++;
    }

    if (productCount % 500 === 0) {
      console.log(`   ${productCount} products, ${priceCount} prices...`);
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Products: ${productCount}`);
  console.log(`   Prices: ${priceCount}`);
  console.log(`   Avg prices per product: ${(priceCount / productCount).toFixed(1)}`);

  // Stats
  const stats = await sql`
    SELECT 
      COUNT(*) as total_products,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image,
      COUNT(*) FILTER (WHERE retailer_count > 1) as multi_retailer,
      COUNT(*) FILTER (WHERE retailer_count >= 3) as all_three,
      AVG(retailer_count) as avg_retailers,
      COUNT(DISTINCT brand) as brands
    FROM cs_products
  `;
  const s = stats[0];
  console.log(`\n📊 Product stats:`);
  console.log(`   Total: ${s.total_products}`);
  console.log(`   With images: ${s.with_image} (${Math.round(s.with_image / s.total_products * 100)}%)`);
  console.log(`   Multi-retailer: ${s.multi_retailer}`);
  console.log(`   All 3 retailers: ${s.all_three}`);
  console.log(`   Avg retailers: ${Number(s.avg_retailers).toFixed(2)}`);
  console.log(`   Brands: ${s.brands}`);

  const topMulti = await sql`
    SELECT name, brand, retailer_count, min_price, max_price
    FROM cs_products WHERE retailer_count >= 2
    ORDER BY retailer_count DESC, brand
    LIMIT 10
  `;
  console.log(`\n🏆 Top multi-retailer products:`);
  topMulti.forEach(p => {
    const saving = p.max_price && p.min_price ? 
      `(save £${(Number(p.max_price) - Number(p.min_price)).toFixed(2)})` : '';
    console.log(`   ${p.brand} ${p.name} - ${p.retailer_count} retailers, £${p.min_price}-£${p.max_price} ${saving}`);
  });
}

/**
 * Generate a canonical key for deduplication.
 * Strips quantity, "Cuban", "Cigar/Cigars", packaging, normalises spacing.
 */
function canonicalKey(name, brand) {
  return name
    .toLowerCase()
    // Remove quantity suffixes: "- 1 Single", "- Box of 25", "- Pack of 5", etc.
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    // Remove GQ format: "- Single Cigar", "- Box of 20 Cigars"
    .replace(/\s*-\s*(single cigar|box of \d+ cigars?|pack of \d+ cigars?)$/i, '')
    // Remove parenthetical notes
    .replace(/\s*\([^)]*\)/g, '')
    // Remove "Cuban" (Smoke King adds this)
    .replace(/\s+cuban\s+/gi, ' ')
    // Remove "Cigar" / "Cigars"
    .replace(/\s+cigars?\b/gi, '')
    // Remove "Tubed" as a separate word (keep in product name like "Tubos")
    .replace(/\s+tubed\b/gi, '')
    // GQ uses "Brand - Product - Size" format, normalise dashes
    .replace(/\s*-\s*/g, ' ')
    // CGars exclusive tags
    .replace(/\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a canonical product from a group of matched cigars.
 * Picks the best image, richest description, etc.
 */
function buildCanonicalProduct(cigars) {
  // Sort by data quality: prefer entries with images and descriptions
  const sorted = [...cigars].sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    if (a.image_url) scoreA += 2;
    if (b.image_url) scoreB += 2;
    // Prefer GQ/CGars images over Smoke King (full cigar vs band)
    if (a.image_url && a.image_url.includes('bigcommerce')) scoreA += 3;
    if (b.image_url && b.image_url.includes('bigcommerce')) scoreB += 3;
    if (a.image_url && a.image_url.includes('cgarsltd')) scoreA += 2;
    if (b.image_url && b.image_url.includes('cgarsltd')) scoreB += 2;
    if (a.description && a.description.length > 20) scoreA += 1;
    if (b.description && b.description.length > 20) scoreB += 1;
    if (a.strength) scoreA += 1;
    if (b.strength) scoreB += 1;
    return scoreB - scoreA;
  });

  const best = sorted[0];
  const prices = cigars.filter(c => c.price > 0).map(c => Number(c.price));
  const retailers = new Set(cigars.map(c => c.retailer));

  // Build a clean canonical name from the best entry
  let canonName = cleanProductName(best.name);

  return {
    name: canonName,
    brand: best.brand,
    description: sorted.find(c => c.description && c.description.length > 20)?.description || '',
    image_url: best.image_url || sorted.find(c => c.image_url)?.image_url || null,
    format: best.format || sorted.find(c => c.format)?.format || null,
    strength: best.strength || sorted.find(c => c.strength)?.strength || null,
    country: best.country || sorted.find(c => c.country)?.country || null,
    length_mm: best.length_mm || sorted.find(c => c.length_mm)?.length_mm || null,
    ring_gauge: best.ring_gauge || sorted.find(c => c.ring_gauge)?.ring_gauge || null,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    retailer_count: retailers.size,
  };
}

/**
 * Clean up a product name for canonical display.
 */
function cleanProductName(name) {
  return name
    // Remove quantity suffixes
    .replace(/\s*-\s*(1 Single|Single|Pack of \d+|Box of \d+|Tin of \d+|Cab(inet)? of \d+|Bundle of \d+|Twist of \d+|\d+ Cigars?).*$/i, '')
    // Remove GQ suffixes
    .replace(/\s*-\s*(Single Cigar|Box of \d+ Cigars?)$/i, '')
    // Remove parenthetical notes
    .replace(/\s*\((?:Discontinued|End of Line|Sold Out|Tubed|Best Dad|Happy Birthday)[^)]*\)/gi, '')
    // Normalise "Brand - Product" to "Brand Product"
    .replace(/\s*-\s*/g, ' ')
    // Remove trailing "Cigar" (keep "Cigars" plural for samplers)
    .replace(/\s+Cigar$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate prices per retailer.
 * If multiple entries from same retailer match, pick the cheapest "single" one.
 */
function deduplicateRetailerPrices(cigars) {
  const byRetailer = new Map();
  
  for (const c of cigars) {
    if (!byRetailer.has(c.retailer)) byRetailer.set(c.retailer, []);
    byRetailer.get(c.retailer).push(c);
  }

  const prices = [];
  for (const [retailer, entries] of byRetailer) {
    // Prefer single/1-single entries for the price
    const singles = entries.filter(e => 
      e.name.toLowerCase().includes('single') || 
      e.name.toLowerCase().includes('1 single')
    );
    // Also include box/pack prices as separate entries
    const boxes = entries.filter(e => 
      e.name.toLowerCase().match(/box of|pack of|bundle of|cabinet of|tin of/)
    );

    // Add the single price
    const single = singles.length > 0 ? singles[0] : entries[0];
    prices.push({
      retailer: single.retailer,
      retailer_url: single.retailer_url,
      price: single.price,
      original_price: single.original_price,
      currency: single.currency || 'GBP',
      available: single.available,
      url: single.url,
      source_name: single.name,
      source_id: single.source_id,
      scraped_at: single.scraped_at,
    });

    // Add distinct box/pack prices (different quantity = different price point)
    for (const box of boxes) {
      // Don't duplicate if same price as single
      if (Number(box.price) === Number(single.price)) continue;
      prices.push({
        retailer: box.retailer,
        retailer_url: box.retailer_url,
        price: box.price,
        original_price: box.original_price,
        currency: box.currency || 'GBP',
        available: box.available,
        url: box.url,
        source_name: box.name,
        source_id: box.source_id,
        scraped_at: box.scraped_at,
      });
    }
  }

  return prices;
}

migrate().catch(e => { console.error(e); process.exit(1); });
