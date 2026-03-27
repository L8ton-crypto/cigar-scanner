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
  // Try all_products.php for cigars
  console.log('=== all_products.php ===');
  const html = await fetchPage('/all_products.php');
  console.log('Length:', html.length);
  
  // Check for products
  const pLinks = (html.match(/-p-\d+\.html/g) || []);
  console.log('Product links:', pLinks.length);
  
  const prices = html.match(/£[\d,.]+/g);
  console.log('Prices:', prices?.length, prices?.slice(0, 5));
  
  // Try a specific Cuban brand category listing
  // From sitemap: cuban-cigars-bolivar
  console.log('\n=== Bolivar listing ===');
  const sm = await fetchPage('/sitemap.xml');
  const urls = sm.match(/<loc>([^<]+)<\/loc>/g) || [];
  const catUrls = urls.map(u => u.replace(/<\/?loc>/g, '')).filter(u => u.includes('-c-') && u.includes('bolivar'));
  console.log('Bolivar cats:', catUrls);
  
  if (catUrls.length) {
    const catHtml = await fetchPage(catUrls[0]);
    console.log('Length:', catHtml.length);
    
    const catPlinks = (catHtml.match(/-p-\d+\.html/g) || []);
    const catPrices = catHtml.match(/£[\d,.]+/g);
    console.log('Product links:', catPlinks.length);
    console.log('Prices:', catPrices?.length, catPrices?.slice(0, 10));
    
    // Find product listing structure
    const listingIdx = catHtml.indexOf('listingProduct');
    if (listingIdx > -1) {
      console.log('\n=== LISTING STRUCTURE ===');
      console.log(catHtml.substring(listingIdx - 100, listingIdx + 1500));
    }
    
    // Look for product name + price patterns
    const productCards = catHtml.match(/<a[^>]*-p-\d+\.html[^>]*>[^<]*<\/a>[^]*?£[\d,.]+/g);
    console.log('\nProduct+price patterns:', productCards?.length);
    productCards?.slice(0, 3).forEach(c => console.log(c.substring(0, 300), '\n'));
  }
}

explore().catch(console.error);
