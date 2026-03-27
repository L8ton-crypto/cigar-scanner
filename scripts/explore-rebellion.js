const https = require('https');

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.rebellioncigars.co.uk',
      path: path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    };
    https.get(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function explore() {
  // Get a search page and extract full product card HTML structure
  const html = await fetchPage('/search/products?keywords=&page=1');
  
  // Find item-heading + surrounding context to understand card structure
  const headingMatches = [];
  let idx = 0;
  while (true) {
    const pos = html.indexOf('class="item-heading"', idx);
    if (pos === -1) break;
    // Get 1500 chars around each heading
    const start = Math.max(0, pos - 800);
    const end = Math.min(html.length, pos + 700);
    headingMatches.push(html.substring(start, end));
    idx = pos + 20;
  }
  
  console.log(`Found ${headingMatches.length} product cards\n`);
  
  // Show first 2 cards in detail
  for (let i = 0; i < Math.min(2, headingMatches.length); i++) {
    console.log(`=== CARD ${i + 1} ===`);
    console.log(headingMatches[i]);
    console.log('\n');
  }
  
  // Now check total pages - search for pagination
  const lastPage = html.match(/page=(\d+)/g);
  console.log('Page links found:', [...new Set(lastPage || [])]);
  
  // Check how many total pages there are
  for (let p = 1; p <= 30; p++) {
    const h = await fetchPage(`/search/products?keywords=&page=${p}`);
    const items = (h.match(/class="item-heading"/g) || []).length;
    if (items === 0) {
      console.log(`\nLast page with results: ${p - 1}`);
      break;
    }
    console.log(`Page ${p}: ${items} products`);
  }
}

explore().catch(console.error);
