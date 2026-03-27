const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
function getDb() { return neon(process.env.DATABASE_URL); }

(async () => {
  let sql = getDb();
  
  // Count bad images
  const bad = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url LIKE '%404-humidor%' OR image_url LIKE '%generic/images%'`;
  console.log('Products with placeholder/404 images:', bad[0].c);
  
  // Clear them - better to have no image than a wrong one
  sql = getDb();
  await sql`UPDATE cs_products SET image_url = '' WHERE image_url LIKE '%404-humidor%' OR image_url LIKE '%generic/images%'`;
  console.log('Cleared placeholder images');
  
  // Now check if any of these products have prices from other retailers with images in source data
  // We can try to cross-reference again
  const fs = require('fs');
  const files = [
    'gq-tobaccos-cigars.json', 'havana-house-cigars.json', 'house-of-cigars-data.json',
    'rebellion-data.json', 'sautter-data.json', 'smoke-king-cigars.json'
  ];
  
  function normalise(name) {
    return name.toLowerCase()
      .replace(/[–—-]/g, ' ').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
      .replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '').replace(/\bcuban\b/gi, '')
      .replace(/\b1\b/g, '').replace(/\bems\b/gi, '')
      .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
      .replace(/\b\d+ x packs?\b/gi, '').replace(/\bbundle of \d+/gi, '').replace(/\btubed?\b/gi, '')
      .replace(/\b\(.*?\)/g, '').replace(/no\s*\.?\s*(\d)/g, 'no$1')
      .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  
  const imageMap = new Map();
  for (const file of files) {
    const fp = path.join(__dirname, '..', file);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const item of data) {
      const img = item.image || item.imageUrl || item.image_url || '';
      if (img && img.length > 5 && !img.includes('404') && !img.includes('placeholder')) {
        const norm = normalise(item.name);
        if (!imageMap.has(norm)) imageMap.set(norm, img);
      }
    }
  }
  
  sql = getDb();
  const noImg = await sql`SELECT id, name FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  console.log('\nProducts now missing images:', noImg.length);
  
  let fixed = 0;
  for (const p of noImg) {
    const norm = normalise(p.name);
    const img = imageMap.get(norm);
    if (img) {
      sql = getDb();
      await sql`UPDATE cs_products SET image_url = ${img} WHERE id = ${p.id}`;
      fixed++;
    }
  }
  console.log('Cross-referenced from other retailers:', fixed);
  
  sql = getDb();
  const finalMissing = await sql`SELECT COUNT(*) as c FROM cs_products WHERE image_url IS NULL OR image_url = ''`;
  const total = await sql`SELECT COUNT(*) as c FROM cs_products`;
  const pct = Math.round((1 - finalMissing[0].c / total[0].c) * 100);
  console.log('\nFinal: ' + finalMissing[0].c + ' missing / ' + total[0].c + ' total (' + pct + '% coverage)');
})();
