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
  // Fetch the cigars category page
  const html = await fetchPage('/cigars-1');
  
  // Find product blocks - look for product card patterns
  // ShopWired typically uses div.product or similar
  const productBlocks = html.match(/<div[^>]*class="[^"]*product[^"]*"[\s\S]*?<\/div>/g);
  console.log('Product blocks:', productBlocks?.length);
  
  // Find all product URLs from the page
  const productUrls = html.match(/href="\/([^"]*-cigar[^"]*)"/g);
  console.log('\nCigar URLs:', productUrls?.length);
  productUrls?.slice(0, 5).forEach(u => console.log('  ', u));
  
  // Find all URLs with prices nearby
  const productSections = html.match(/<a[^>]*href="\/[^"]*"[^>]*>[\s\S]*?&pound;[\d.]+[\s\S]*?<\/a>/g);
  console.log('\nProduct sections with prices:', productSections?.length);
  
  // Look for data attributes
  const dataAttrs = html.match(/data-product[^=]*="[^"]*"/g);
  console.log('\nData attributes:', [...new Set(dataAttrs || [])].slice(0, 10));
  
  // Search for the product listing pattern
  const productIdPattern = html.match(/product_id[^=]*=["']?(\d+)/g);
  console.log('\nProduct IDs:', productIdPattern?.slice(0, 5));
  
  // Check for pagination
  const pagination = html.match(/page=(\d+)/g);
  console.log('\nPagination:', [...new Set(pagination || [])]);
  
  // Try to find product grid/list container
  const containers = html.match(/class="[^"]*product-list[^"]*"|class="[^"]*product-grid[^"]*"|class="[^"]*products[^"]*"/g);
  console.log('\nProduct containers:', containers?.slice(0, 5));
  
  // Find all href links that look like product pages
  const allLinks = html.match(/href="\/([^"]+)"/g);
  const uniqueLinks = [...new Set(allLinks || [])];
  const productLikeLinks = uniqueLinks.filter(l => !l.includes('search') && !l.includes('account') && !l.includes('contact') && !l.includes('javascript'));
  console.log('\nAll unique links:', uniqueLinks.length);
  console.log('Product-like links:', productLikeLinks.length);
  productLikeLinks.slice(0, 10).forEach(l => console.log('  ', l));
  
  // Extract a sample of HTML near pound signs
  const poundContexts = [];
  let idx = 0;
  while (idx < html.length && poundContexts.length < 3) {
    const pos = html.indexOf('&pound;', idx);
    if (pos === -1) break;
    poundContexts.push(html.substring(Math.max(0, pos - 200), pos + 50));
    idx = pos + 1;
  }
  console.log('\n=== POUND CONTEXTS ===');
  poundContexts.forEach((c, i) => console.log(`\n--- Context ${i+1} ---\n`, c));
}

test().catch(console.error);
