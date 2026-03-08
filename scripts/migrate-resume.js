const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

async function resume() {
  // Get existing product names to skip
  const existing = await sql`SELECT name, brand FROM cs_products`;
  const existingKeys = new Set(existing.map(e => e.name.toLowerCase() + '|' + e.brand.toLowerCase()));
  console.log(`Already migrated: ${existing.length} products`);

  // Load all cigars and group
  const allCigars = await sql`
    SELECT id, name, brand, description, price, original_price, currency,
           available, url, image_url, retailer, retailer_url, category,
           format, strength, country, length_mm, ring_gauge, source_id, scraped_at
    FROM cs_cigars WHERE available = true ORDER BY brand, name
  `;

  const groups = new Map();
  for (const cigar of allCigars) {
    const key = canonicalKey(cigar.name, cigar.brand);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cigar);
  }

  let inserted = 0;
  let skipped = 0;
  let priceCount = 0;

  for (const [key, cigars] of groups) {
    const product = buildCanonicalProduct(cigars);
    const checkKey = product.name.toLowerCase() + '|' + product.brand.toLowerCase();
    
    if (existingKeys.has(checkKey)) {
      skipped++;
      continue;
    }

    const result = await sql`
      INSERT INTO cs_products (name, brand, description, image_url, format, strength, country, length_mm, ring_gauge, min_price, max_price, retailer_count)
      VALUES (${product.name}, ${product.brand}, ${product.description}, ${product.image_url},
              ${product.format}, ${product.strength}, ${product.country},
              ${product.length_mm}, ${product.ring_gauge},
              ${product.min_price}, ${product.max_price}, ${product.retailer_count})
      RETURNING id
    `;
    const productId = result[0].id;
    inserted++;

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

    if (inserted % 100 === 0) console.log(`  +${inserted} products, ${priceCount} prices...`);
  }

  console.log(`\nDone! Inserted ${inserted}, skipped ${skipped} existing, ${priceCount} new prices`);
  
  const total = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const totalPrices = await sql`SELECT COUNT(*) as c FROM cs_prices`;
  console.log(`Total: ${total[0].c} products, ${totalPrices[0].c} prices`);
}

function canonicalKey(name, brand) {
  return name.toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*-\s*(single cigar|box of \d+ cigars?|pack of \d+ cigars?)$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+cuban\s+/gi, ' ')
    .replace(/\s+cigars?\b/gi, '')
    .replace(/\s+tubed\b/gi, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCanonicalProduct(cigars) {
  const sorted = [...cigars].sort((a, b) => {
    let sA = 0, sB = 0;
    if (a.image_url) sA += 2;
    if (b.image_url) sB += 2;
    if (a.image_url && a.image_url.includes('bigcommerce')) sA += 3;
    if (b.image_url && b.image_url.includes('bigcommerce')) sB += 3;
    if (a.image_url && a.image_url.includes('cgarsltd')) sA += 2;
    if (b.image_url && b.image_url.includes('cgarsltd')) sB += 2;
    if (a.description && a.description.length > 20) sA += 1;
    if (b.description && b.description.length > 20) sB += 1;
    return sB - sA;
  });
  const best = sorted[0];
  const prices = cigars.filter(c => c.price > 0).map(c => Number(c.price));
  const retailers = new Set(cigars.map(c => c.retailer));
  let name = best.name
    .replace(/\s*-\s*(1 Single|Single|Pack of \d+|Box of \d+|Tin of \d+|Cab(inet)? of \d+|Bundle of \d+|Twist of \d+|\d+ Cigars?).*$/i, '')
    .replace(/\s*-\s*(Single Cigar|Box of \d+ Cigars?)$/i, '')
    .replace(/\s*\((?:Discontinued|End of Line|Sold Out|Tubed|Best Dad|Happy Birthday)[^)]*\)/gi, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+Cigar$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    name, brand: best.brand,
    description: sorted.find(c => c.description && c.description.length > 20)?.description || '',
    image_url: best.image_url || sorted.find(c => c.image_url)?.image_url || null,
    format: best.format || sorted.find(c => c.format)?.format || null,
    strength: best.strength || sorted.find(c => c.strength)?.strength || null,
    country: best.country || null,
    length_mm: best.length_mm || null,
    ring_gauge: best.ring_gauge || null,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    retailer_count: retailers.size,
  };
}

function deduplicateRetailerPrices(cigars) {
  const byRetailer = new Map();
  for (const c of cigars) {
    if (!byRetailer.has(c.retailer)) byRetailer.set(c.retailer, []);
    byRetailer.get(c.retailer).push(c);
  }
  const prices = [];
  for (const [retailer, entries] of byRetailer) {
    const singles = entries.filter(e => e.name.toLowerCase().includes('single'));
    const single = singles.length > 0 ? singles[0] : entries[0];
    prices.push({
      retailer: single.retailer, retailer_url: single.retailer_url,
      price: single.price, original_price: single.original_price,
      currency: single.currency || 'GBP', available: single.available,
      url: single.url, source_name: single.name,
      source_id: single.source_id, scraped_at: single.scraped_at,
    });
    const boxes = entries.filter(e => e.name.toLowerCase().match(/box of|pack of|bundle of|cabinet of|tin of/));
    for (const box of boxes) {
      if (Number(box.price) === Number(single.price)) continue;
      prices.push({
        retailer: box.retailer, retailer_url: box.retailer_url,
        price: box.price, original_price: box.original_price,
        currency: box.currency || 'GBP', available: box.available,
        url: box.url, source_name: box.name,
        source_id: box.source_id, scraped_at: box.scraped_at,
      });
    }
  }
  return prices;
}

resume().catch(e => { console.error(e); process.exit(1); });
