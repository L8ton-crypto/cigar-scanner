const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function matchImages() {
  console.log('🔍 Finding image matches between retailers...\n');

  // Get all Smoke King entries with images
  const smokeKing = await sql`
    SELECT id, name, brand, image_url 
    FROM cs_cigars 
    WHERE retailer = 'Smoke King' AND image_url IS NOT NULL AND image_url != ''
  `;
  console.log(`📸 Smoke King entries with images: ${smokeKing.length}`);

  // Get all CGars entries without images
  const cgarsNoImage = await sql`
    SELECT id, name, brand 
    FROM cs_cigars 
    WHERE retailer = 'C.Gars Ltd' AND (image_url IS NULL OR image_url = '')
  `;
  console.log(`🚬 CGars entries without images: ${cgarsNoImage.length}\n`);

  // Build a lookup from Smoke King: normalised name -> image_url
  // Normalise: lowercase, strip quantity suffixes, strip common noise
  const skLookup = new Map(); // normalised name -> { image_url, original_name }
  
  for (const sk of smokeKing) {
    const key = normalise(sk.name, sk.brand);
    if (!skLookup.has(key)) {
      skLookup.set(key, { image_url: sk.image_url, name: sk.name });
    }
  }
  console.log(`🗂️  Smoke King unique normalised names: ${skLookup.size}`);

  // Match CGars entries
  let exactMatches = 0;
  let brandMatches = 0;
  const updates = []; // { cgarsId, imageUrl, matchType, skName, cgName }

  for (const cg of cgarsNoImage) {
    const cgKey = normalise(cg.name, cg.brand);
    
    // Try exact normalised match
    if (skLookup.has(cgKey)) {
      const sk = skLookup.get(cgKey);
      updates.push({ id: cg.id, image_url: sk.image_url, type: 'exact', skName: sk.name, cgName: cg.name });
      exactMatches++;
      continue;
    }

    // Try fuzzy: strip everything after the base cigar name (before " - ")
    const cgBase = getBaseName(cg.name, cg.brand);
    for (const [skKey, sk] of skLookup) {
      const skBase = getBaseName(sk.name, cg.brand);
      if (cgBase && skBase && cgBase === skBase) {
        updates.push({ id: cg.id, image_url: sk.image_url, type: 'base', skName: sk.name, cgName: cg.name });
        brandMatches++;
        break;
      }
    }
  }

  console.log(`\n✅ Exact matches: ${exactMatches}`);
  console.log(`🔄 Base name matches: ${brandMatches}`);
  console.log(`📊 Total images to copy: ${updates.length}`);

  // Show some sample matches
  console.log('\n📋 Sample matches:');
  const samples = updates.slice(0, 15);
  for (const u of samples) {
    console.log(`  [${u.type}] "${u.cgName}" ← "${u.skName}"`);
  }

  if (updates.length === 0) {
    console.log('\nNo matches found.');
    return;
  }

  // Apply updates
  console.log(`\n⬆️  Applying ${updates.length} image updates...`);
  let applied = 0;
  for (const u of updates) {
    await sql`UPDATE cs_cigars SET image_url = ${u.image_url} WHERE id = ${u.id}`;
    applied++;
    if (applied % 100 === 0) console.log(`  Updated ${applied}/${updates.length}`);
  }

  console.log(`\n🎉 Done! Applied ${applied} image updates.`);

  // Final stats
  const stats = await sql`
    SELECT 
      retailer,
      COUNT(*) as total,
      COUNT(image_url) as with_image,
      COUNT(*) - COUNT(image_url) as without_image
    FROM cs_cigars
    GROUP BY retailer
  `;
  console.log('\n📊 Final image coverage:');
  for (const s of stats) {
    const pct = Math.round((s.with_image / s.total) * 100);
    console.log(`  ${s.retailer}: ${s.with_image}/${s.total} have images (${pct}%)`);
  }
}

function normalise(name, brand) {
  return name
    .toLowerCase()
    // Remove quantity suffixes
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+).*$/i, '')
    // Remove "(Discontinued)", "(End of Line)", "(Sold Out)" etc
    .replace(/\s*\((?:discontinued|end of line|sold out|best dad band|happy birthday band)[^)]*\)/gi, '')
    // Remove "Cuban" descriptor that Smoke King adds
    .replace(/\s+cuban\s+/i, ' ')
    // Normalise "Cigar" / "Cigars"  
    .replace(/\s+cigars?\s*/gi, ' ')
    // Remove "- C.Gars Exclusive", "- C.Gars Featured Brand"
    .replace(/\s*-\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function getBaseName(name, brand) {
  // Get the core cigar name: brand + product line, before quantity/packaging
  let base = name
    .replace(/\s*-\s*(1 Single|Single|Pack of \d+|Box of \d+|Tin of \d+|Cab(inet)? of \d+|Bundle of \d+|Twist of \d+).*$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+Cuban\s+/i, ' ')
    .replace(/\s+Cigars?\s*/gi, ' ')
    .replace(/\s+Tubed\s*/gi, ' ')
    .replace(/\s*-\s*C\.?Gars?\s*(Exclusive|Featured Brand)/gi, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
  
  return base || null;
}

matchImages().catch(console.error);
