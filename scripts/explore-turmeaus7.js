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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function explore() {
  // Check if listing pages include prices  
  const html = await fetchPage('/all_products.php?page=1');
  
  // Find product cards with prices
  const cards = html.match(/<div class="product-listing-box">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g);
  console.log('Product cards found:', cards?.length);
  
  if (cards && cards.length > 0) {
    console.log('\n=== FIRST CARD ===');
    console.log(cards[0]);
    
    console.log('\n=== SECOND CARD ===');
    console.log(cards[1]);
  }
  
  // Check for price in listing
  const priceInListing = html.match(/product-price[^>]*>[^<]*£[\d,.]+/g);
  console.log('\nPrices in listing:', priceInListing?.length, priceInListing?.slice(0, 5));
  
  // Look for any price near product names
  const namePrice = html.match(/-p-\d+\.html[^]*?£[\d,.]+/g);
  console.log('\nName+price combos:', namePrice?.length);
  if (namePrice) {
    namePrice.slice(0, 2).forEach(np => console.log(np.substring(0, 400), '\n'));
  }
  
  // Check cigars-specific category URL from nav
  const cigarCats = html.match(/href="[^"]*cigars[^"]*-c-[^"]*"/gi);
  console.log('\nCigar category URLs:', cigarCats?.length);
  const uniqueCats = [...new Set(cigarCats || [])].slice(0, 20);
  uniqueCats.forEach(c => console.log('  ', c));
}

explore().catch(console.error);
