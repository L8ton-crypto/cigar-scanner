/**
 * Deduplicate source JSON files by NORMALIZED name.
 * This catches variations like "Cohiba Robusto - Single" and "Cohiba Robusto Cigar - 1 Single"
 */
const fs = require('fs');
const path = require('path');

function normalise(name) {
  return name.toLowerCase()
    .replace(/[–—]/g, '-').replace(/&#\d+;/g, '').replace(/[''""]/g, '')
    .replace(/\s*-\s*/g, ' ').replace(/\bcigar[s]?\b/gi, '').replace(/\bsingle\b/gi, '')
    .replace(/\btin of \d+/gi, '').replace(/\bbox of \d+/gi, '').replace(/\bpack[s]? of \d+/gi, '')
    .replace(/\b\d+ x packs?\b/gi, '').replace(/^[^:]+:\s*/i, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const files = [
  'cgars-cigars.json',
  'gq-tobaccos-cigars.json',
  'havana-house-cigars.json',
  'house-of-cigars-data.json',
  'rebellion-data.json',
  'sautter-data.json',
  'smoke-king-cigars.json',
];

let totalRemoved = 0;

for (const file of files) {
  const filePath = path.join(__dirname, '..', file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const seen = new Set();
  const deduped = data.filter(item => {
    const key = normalise(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  const removed = data.length - deduped.length;
  totalRemoved += removed;
  
  if (removed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(deduped, null, 2));
    console.log(`✅ ${file}: ${data.length} → ${deduped.length} (removed ${removed})`);
  } else {
    console.log(`   ${file}: ${data.length} items (no dupes)`);
  }
}

console.log(`\n📊 Total removed: ${totalRemoved}`);
