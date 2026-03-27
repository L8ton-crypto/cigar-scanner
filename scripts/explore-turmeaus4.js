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
  // Count total cigar products in sitemap
  const sm = await fetchPage('/sitemap.xml');
  const allUrls = sm.match(/<loc>([^<]+)<\/loc>/g) || [];
  const productUrls = allUrls
    .map(u => u.replace(/<\/?loc>/g, ''))
    .filter(u => u.includes('-p-'));
  
  const cigarProductUrls = productUrls.filter(u => 
    u.includes('cigar') || u.includes('cohiba') || u.includes('montecristo') || 
    u.includes('partagas') || u.includes('bolivar') || u.includes('romeo') ||
    u.includes('punch') || u.includes('upmann') || u.includes('hoyo') ||
    u.includes('davidoff') || u.includes('padron') || u.includes('arturo') ||
    u.includes('fuente') || u.includes('oliva') || u.includes('corona') ||
    u.includes('robusto') || u.includes('churchill') || u.includes('torpedo')
  );
  
  console.log(`Total product URLs in sitemap: ${productUrls.length}`);
  console.log(`Cigar-related: ${cigarProductUrls.length}`);
  
  // Look at a specific product page in detail
  const html = await fetchPage('/romeo-julieta-linea-oro-hidalgos-cigar-single-p-49280.html');
  
  // Find the actual product price - look for price-related classes
  const priceMatches = html.match(/class="[^"]*price[^"]*"[^>]*>[^<]*£[\d,.]+[^<]*/gi);
  console.log('\nPrice with class:', priceMatches);
  
  // Look for productPrice or similar
  const productPrice = html.match(/product[Pp]rice[^>]*>[^<]*/g);
  console.log('productPrice:', productPrice);
  
  // Look for itemprop price
  const itemPrice = html.match(/itemprop="price"[^>]*/g);
  console.log('itemprop price:', itemPrice);
  
  // Look for meta with price
  const metaPrice = html.match(/<meta[^>]*price[^>]*/gi);
  console.log('meta price:', metaPrice);
  
  // Find the price near "cart" section
  const cartIdx = html.indexOf('cart_quantity');
  if (cartIdx > -1) {
    const nearby = html.substring(Math.max(0, cartIdx - 1000), cartIdx + 500);
    // Find all £ in that region
    const nearPrices = nearby.match(/£[\d,.]+/g);
    console.log('\nPrices near cart:', nearPrices);
    
    // Show the chunk
    console.log('\n=== NEAR CART ===');
    console.log(nearby.substring(0, 800));
  }
  
  // Check for zen-cart specific price ID
  const normPrice = html.match(/id="[^"]*[pP]rice[^"]*"[^>]*>[^<]*/g);
  console.log('\nPrice by ID:', normPrice);
  
  // JSON-LD
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonLd) {
    console.log('\n=== JSON-LD ===');
    jsonLd.forEach(j => console.log(j.substring(0, 500)));
  }
}

explore().catch(console.error);
