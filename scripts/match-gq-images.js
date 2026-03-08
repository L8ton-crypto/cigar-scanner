const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function matchGQImages() {
  // Load GQ data
  const gqData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gq-tobaccos-cigars.json'), 'utf8'));
  console.log(`📦 GQ Tobaccos: ${gqData.length} products with images\n`);

  // Build GQ lookup by normalised name
  const gqLookup = new Map();
  for (const gq of gqData) {
    const key = normalise(gq.name);
    if (!gqLookup.has(key)) {
      gqLookup.set(key, gq);
    }
    // Also store base name variant
    const base = getBaseName(gq.name);
    if (base && !gqLookup.has(base)) {
      gqLookup.set(base, gq);
    }
  }
  console.log(`🗂️  GQ unique normalised names: ${gqLookup.size}`);

  // Get all entries without images
  const noImage = await sql`
    SELECT id, name, brand, retailer
    FROM cs_cigars 
    WHERE image_url IS NULL OR image_url = ''
  `;
  console.log(`🚬 Entries without images: ${noImage.length}\n`);

  const updates = [];

  for (const cigar of noImage) {
    const key = normalise(cigar.name);
    
    // Exact normalised match
    if (gqLookup.has(key)) {
      const gq = gqLookup.get(key);
      updates.push({ id: cigar.id, image_url: gq.imageUrl, type: 'exact', gqName: gq.name, dbName: cigar.name });
      continue;
    }

    // Base name match
    const base = getBaseName(cigar.name);
    if (base && gqLookup.has(base)) {
      const gq = gqLookup.get(base);
      updates.push({ id: cigar.id, image_url: gq.imageUrl, type: 'base', gqName: gq.name, dbName: cigar.name });
      continue;
    }

    // Brand + product line fuzzy match
    // Strip "Cigar" and quantity, compare
    const fuzzy = fuzzyNormalise(cigar.name);
    for (const [gqKey, gq] of gqLookup) {
      const gqFuzzy = fuzzyNormalise(gq.name);
      if (fuzzy && gqFuzzy && fuzzy === gqFuzzy) {
        updates.push({ id: cigar.id, image_url: gq.imageUrl, type: 'fuzzy', gqName: gq.name, dbName: cigar.name });
        break;
      }
    }
  }

  console.log(`✅ Matches found: ${updates.length}`);
  console.log(`  Exact: ${updates.filter(u => u.type === 'exact').length}`);
  console.log(`  Base: ${updates.filter(u => u.type === 'base').length}`);
  console.log(`  Fuzzy: ${updates.filter(u => u.type === 'fuzzy').length}`);

  console.log('\n📋 Sample matches:');
  updates.slice(0, 10).forEach(u => {
    console.log(`  [${u.type}] "${u.dbName}" ← "${u.gqName}"`);
  });

  if (updates.length === 0) {
    console.log('No matches found.');
    return;
  }

  // Apply
  console.log(`\n⬆️  Applying ${updates.length} image updates...`);
  let applied = 0;
  for (const u of updates) {
    try {
      await sql`UPDATE cs_cigars SET image_url = ${u.image_url} WHERE id = ${u.id}`;
      applied++;
      if (applied % 200 === 0) console.log(`  Updated ${applied}/${updates.length}`);
    } catch (e) {
      console.error(`  Error updating ${u.id}: ${e.message}`);
    }
  }
  console.log(`\n🎉 Applied ${applied} image updates.`);

  // Stats
  const stats = await sql`
    SELECT retailer,
      COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars GROUP BY retailer
  `;
  console.log('\n📊 Final image coverage:');
  for (const s of stats) {
    const pct = Math.round((s.with_image / s.total) * 100);
    console.log(`  ${s.retailer}: ${s.with_image}/${s.total} (${pct}%)`);
  }
}

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*\((?:discontinued|end of line|sold out|tubed|best dad|happy birthday)[^)]*\)/gi, '')
    .replace(/\s+cuban\s+/gi, ' ')
    .replace(/\s+cigars?\s*/gi, ' ')
    .replace(/\s*-\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBaseName(name) {
  return name
    .replace(/\s*-\s*(1 Single|Single|Pack of \d+|Box of \d+|Tin of \d+|Cab(inet)? of \d+|Bundle of \d+|\d+ Cigars?).*$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+Cuban\s+/gi, ' ')
    .replace(/\s+Cigars?\s*/gi, ' ')
    .replace(/\s+Tubed\s*/gi, ' ')
    .replace(/\s*-\s*C\.?Gars?\s*(Exclusive|Featured Brand)/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function fuzzyNormalise(name) {
  // Even more aggressive: strip brand prefixes like "Brand - ", quantity, cigar/cigars, format names
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+cuban\s+/gi, ' ')
    .replace(/\s+cigars?\b/gi, '')
    .replace(/\s+tubed\b/gi, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

matchGQImages().catch(console.error);
