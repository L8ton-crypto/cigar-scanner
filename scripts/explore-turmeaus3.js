const https = require('https');

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://www.turmeaus.co.uk');
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Cookie': 'cookie_test=please_accept'
      }
    };
    const req = https.get(options, (res) => {
      console.log(`  Status: ${res.statusCode}`);
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log(`  Redirect: ${res.headers.location}`);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function explore() {
  // Get the sitemap to find actual category URLs
  console.log('=== Fetching sitemap for cigar categories ===');
  const sm = await fetchPage('/sitemap.xml');
  
  // Extract cigar-related category URLs from sitemap
  const urls = sm.match(/<loc>([^<]+)<\/loc>/g) || [];
  const cigarUrls = urls
    .map(u => u.replace(/<\/?loc>/g, ''))
    .filter(u => u.includes('cigar') && u.includes('-c-'))
    .slice(0, 20);
  
  console.log(`\nCigar category URLs: ${cigarUrls.length}`);
  cigarUrls.forEach(u => console.log('  ', u));
  
  // Also find product page URLs (-p-)
  const productUrls = urls
    .map(u => u.replace(/<\/?loc>/g, ''))
    .filter(u => u.includes('-p-'))
    .slice(0, 5);
  console.log(`\nSample product URLs: ${productUrls.length}`);
  productUrls.forEach(u => console.log('  ', u));
  
  // Try a product page
  if (productUrls.length) {
    console.log('\n=== Fetching product page ===');
    const html = await fetchPage(productUrls[0]);
    console.log('Length:', html.length);
    
    // Find prices
    const prices = html.match(/£[\d,.]+/g);
    console.log('Prices:', prices?.slice(0, 5));
    
    // Find product name
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    console.log('H1:', h1?.[1]);
    
    // Find add to cart
    const cart = html.match(/cart_quantity|add.*cart/gi);
    console.log('Cart elements:', cart?.length);
  }
  
  // Try a category page  
  if (cigarUrls.length) {
    console.log('\n=== Fetching category page ===');
    const html = await fetchPage(cigarUrls[0]);
    console.log('Length:', html.length);
    
    const prices = html.match(/£[\d,.]+/g);
    console.log('Prices:', prices?.length, prices?.slice(0, 5));
    
    const pLinks = html.match(/-p-\d+\.html/g);
    console.log('Product links:', pLinks?.length);
  }
}

explore().catch(console.error);
