const fs = require('fs');
const path = require('path');

const files = [
  { file: 'cgars-cigars.json', name: 'C.Gars' },
  { file: 'gq-tobaccos-cigars.json', name: 'GQ Tobaccos' },
  { file: 'havana-house-cigars.json', name: 'Havana House' },
  { file: 'house-of-cigars-data.json', name: 'House of Cigars' },
  { file: 'rebellion-data.json', name: 'Rebellion' },
  { file: 'sautter-data.json', name: 'Sautter' },
  { file: 'smoke-king-cigars.json', name: 'Smoke King' },
];

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', f.file), 'utf8'));
  const names = data.map(d => d.name);
  const uniqueNames = new Set(names);
  const dupeCount = names.length - uniqueNames.size;
  console.log(`${f.name}: ${names.length} total, ${uniqueNames.size} unique, ${dupeCount} dupes`);
}
