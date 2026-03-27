const https = require('https');

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://www.turmeaus.co.uk');
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    };
    const req = https.get(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function explore() {
  // all_products.php has 48 product links - let's see the structure
  const html = await fetchPage('/all_products.php');
  
  // Find a product link and surrounding context
  const pIdx = html.indexOf('-p-');
  const chunk = html.substring(Math.max(0, pIdx - 500), pIdx + 500);
  console.log('=== PRODUCT LISTING CARD ===');
  console.log(chunk);
  
  // Check if there's pagination on all_products
  console.log('\n=== PAGINATION ===');
  const pageLinks = html.match(/all_products\.php\?page=\d+/g);
  console.log('Page links:', [...new Set(pageLinks || [])]);
  
  // Also check how many total pages
  const displayingMatch = html.match(/Displaying.*?(\d+)\s*to\s*(\d+)\s*\(of\s*(\d+)/i);
  console.log('Displaying:', displayingMatch?.[0]);
  
  // Check pages 2 and 3
  for (let p = 2; p <= 3; p++) {
    const ph = await fetchPage(`/all_products.php?page=${p}`);
    const pLinks = (ph.match(/-p-\d+\.html/g) || []).length;
    const disp = ph.match(/Displaying.*?(\d+)\s*to\s*(\d+)\s*\(of\s*(\d+)/i);
    console.log(`Page ${p}: ${pLinks} products, ${disp?.[0] || 'no display info'}`);
  }
}

explore().catch(console.error);
