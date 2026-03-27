const https = require('https');

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.turmeaus.co.uk',
      path: path,
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
  // Try a specific brand page (Bolivar is a known Cuban cigar brand)
  const html = await fetchPage('/cuban-cigars-bolivar-cigars-c-1_24.html');
  console.log('Length:', html.length);
  
  // Look for product listing patterns
  const prices = html.match(/£[\d,.]+/g);
  console.log('Prices:', prices?.length);
  
  // Find product cards
  const productNames = html.match(/<a[^>]*>([^<]*(?:Bolivar|Corona|Robusto|Churchill)[^<]*)<\/a>/gi);
  console.log('Product name links:', productNames?.length);
  productNames?.slice(0, 5).forEach(p => console.log('  ', p));
  
  // Look for product listing container
  const idx = html.indexOf('productListing');
  if (idx > -1) {
    console.log('\n=== PRODUCT LISTING ===');
    console.log(html.substring(idx - 100, idx + 2000));
  }
  
  // Also look for structured product data
  const jsonLd = html.match(/<script type="application\/ld\+json">[^<]+<\/script>/g);
  if (jsonLd) {
    console.log('\n=== JSON-LD ===');
    jsonLd.forEach(j => console.log(j.substring(0, 500)));
  }
  
  // Look for data-product or similar
  const dataProduct = html.match(/data-product[^>]*/g);
  console.log('\ndata-product attrs:', dataProduct?.slice(0, 5));
  
  // Look for product price patterns  
  const priceSpans = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>[^<]*<\/span>/g);
  console.log('\nPrice spans:', priceSpans?.length);
  priceSpans?.slice(0, 5).forEach(p => console.log('  ', p));
  
  // Look for product links with -p- pattern (zen-cart style)
  const pLinks = html.match(/href="[^"]*-p-\d+\.html"/g);
  console.log('\nProduct page links:', pLinks?.length);
  pLinks?.slice(0, 5).forEach(l => console.log('  ', l));
}

explore().catch(console.error);
