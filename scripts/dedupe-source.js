/**
 * Deduplicate source JSON files by product name.
 * Keeps the first occurrence, writes back to the same file.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'cgars-cigars.json',
  'gq-tobaccos-cigars.json',
  'havana-house-cigars.json',
  'house-of-cigars-data.json',
  'rebellion-data.json',
  'sautter-data.json',
  'smoke-king-cigars.json',
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const seen = new Set();
  const deduped = data.filter(item => {
    const key = item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  const removed = data.length - deduped.length;
  if (removed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(deduped, null, 2));
    console.log(`✅ ${file}: ${data.length} → ${deduped.length} (removed ${removed} dupes)`);
  } else {
    console.log(`   ${file}: ${data.length} items (no dupes)`);
  }
}
