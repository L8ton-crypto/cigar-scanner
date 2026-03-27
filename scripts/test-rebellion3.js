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

async function test() {
  // The search endpoint returned products before via web_fetch readability
  const html = await fetchPage('/search/products?keywords=&page=1');
  console.log('Length:', html.length);
  
  // Look for product data near pound signs
  const allPound = [];
  let idx = 0;
  while (true) {
    const pos = html.indexOf('&pound;', idx);
    if (pos === -1) break;
    allPound.push(pos);
    idx = pos + 7;
  }
  console.log('Pound occurrences:', allPound.length);
  
  // Extract product cards - look for the pattern around prices
  if (allPound.length > 2) {
    const context = html.substring(Math.max(0, allPound[2] - 500), allPound[2] + 100);
    console.log('\n=== CONTEXT AROUND 3RD PRICE ===');
    console.log(context);
  }
  
  // Look for product links with data
  const productCards = html.match(/<div class="column[^"]*product[^>]*>[\s\S]*?<\/div>\s*<\/div>/g);
  console.log('\nProduct cards:', productCards?.length);
  
  // Look for product-item or similar
  const items = html.match(/class="[^"]*item[^"]*"/g);
  console.log('Item classes:', [...new Set(items || [])].slice(0, 10));
  
  // Check if search with empty keyword returns all products
  const links = html.match(/href="\/[a-z][^"]*"/g);
  const uniqueProductLinks = [...new Set(links || [])].filter(l => 
    !l.includes('/search') && !l.includes('/contact') && !l.includes('/checkout') &&
    !l.includes('/account') && !l.includes('/wishlist') && !l.includes('cdn') &&
    !l.includes('javascript') && !l.includes('/cigars-1') && !l.includes('/accessories') &&
    l.length > 15
  );
  console.log('\nProduct-like links:', uniqueProductLinks.length);
  uniqueProductLinks.slice(0, 10).forEach(l => console.log('  ', l));
  
  // Try to search for all products with empty keywords
  console.log('\n=== SEARCH: ALL ===');
  const html2 = await fetchPage('/search/products?keywords=a');
  const pound2 = (html2.match(/&pound;/g) || []).length;
  console.log('Pounds in search for "a":', pound2);
  
  // Try brand-specific search  
  console.log('\n=== SEARCH: BRAND ===');
  const html3 = await fetchPage('/search/products?keywords=perdomo');
  const pound3 = (html3.match(/&pound;/g) || []).length;
  console.log('Pounds in search for "perdomo":', pound3);
  
  // Extract all products from a search result
  // Pattern: link → product name, price
  const pricePattern = html3.match(/href="\/([^"]+)"[\s\S]*?&pound;([\d.]+)/g);
  console.log('Price patterns:', pricePattern?.length);
  pricePattern?.slice(0, 3).forEach(p => console.log('  ', p.substring(0, 200)));
}

test().catch(console.error);
