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
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log('Redirect to:', res.headers.location);
        resolve(null);
        return;
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
  // Try to find the cigars category listing
  const paths = [
    '/cigars-c1/',
    '/cuban-cigars/',
    '/index.php?main_page=index&cPath=1',
    '/index.php?main_page=advanced_search_result&keyword=cigar',
    '/advanced_search_result.php?keyword=cigar',
    '/search.php?keyword=cigar',
  ];
  
  for (const p of paths) {
    console.log(`\nTrying: ${p}`);
    try {
      const html = await fetchPage(p);
      if (!html) continue;
      console.log(`  Length: ${html.length}`);
      
      // Look for product-like patterns
      const prices = (html.match(/£[\d,.]+|&pound;[\d,.]+/g) || []);
      console.log(`  Prices found: ${prices.length}`);
      if (prices.length) console.log(`  Sample: ${prices.slice(0, 5).join(', ')}`);
      
      // Look for product links
      const productLinks = html.match(/href="[^"]*product[^"]*"/gi);
      console.log(`  Product links: ${productLinks?.length || 0}`);
      if (productLinks) console.log(`  Sample: ${productLinks.slice(0, 3).join('\n    ')}`);
      
      // Look for common e-commerce patterns
      const addToCart = (html.match(/add.to.cart|add.to.basket/gi) || []);
      console.log(`  Add to cart: ${addToCart.length}`);
      
      if (prices.length > 5) {
        // Dump a chunk around first price
        const idx = html.indexOf(prices[0]);
        console.log('\n  === CONTEXT ===');
        console.log(html.substring(Math.max(0, idx - 500), idx + 200));
        break;
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Also check if they have a sitemap
  console.log('\n=== SITEMAP CHECK ===');
  try {
    const sm = await fetchPage('/sitemap.xml');
    if (sm) {
      console.log(`Sitemap length: ${sm.length}`);
      const urls = sm.match(/<loc>[^<]+<\/loc>/g);
      console.log(`URLs found: ${urls?.length || 0}`);
      const productUrls = (urls || []).filter(u => u.includes('product'));
      console.log(`Product URLs: ${productUrls.length}`);
      productUrls.slice(0, 5).forEach(u => console.log(`  ${u}`));
    }
  } catch(e) { console.log('No sitemap'); }
}

explore().catch(console.error);
