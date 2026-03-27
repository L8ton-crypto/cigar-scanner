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
  // Test search pagination
  console.log('=== SEARCH PAGINATION ===');
  for (let page = 1; page <= 3; page++) {
    const html = await fetchPage(`/search/products?keywords=cigar&page=${page}`);
    // Extract product items
    const items = html.match(/class="item-heading">\s*<a[^>]*>([^<]+)<\/a>/g);
    const prices = html.match(/class="price">\s*&pound;([\d.]+)/g);
    console.log(`Page ${page}: ${items?.length || 0} items, ${prices?.length || 0} prices`);
    if (items) items.slice(0, 3).forEach(i => console.log('  ', i.replace(/<[^>]+>/g, '').trim()));
    if (!items || items.length === 0) break;
  }
  
  // Try broader search
  console.log('\n=== BROADER SEARCHES ===');
  const queries = ['', 'single', 'box', 'tin', 'pack'];
  for (const q of queries) {
    const html = await fetchPage(`/search/products?keywords=${q}&page=1`);
    const items = html.match(/class="item-heading"/g);
    console.log(`Search "${q}": ${items?.length || 0} items`);
  }
  
  // Test category page with specific approach
  console.log('\n=== CATEGORY PAGE RAW ===');
  const html = await fetchPage('/cigars-1');
  const itemBoxes = html.match(/class="card item-box product-box"/g);
  console.log('Product boxes found:', itemBoxes?.length || 0);
  
  // Check if products are loaded via AJAX
  const ajaxUrls = html.match(/\/api\/[^"'\s]+|\/products[^"'\s]*/g);
  console.log('AJAX URLs:', ajaxUrls?.slice(0, 5));
  
  // Check for data-src or lazy load patterns
  const dataSrc = html.match(/data-src="[^"]+"/g);
  console.log('Data-src:', dataSrc?.length);
  
  // Check for JavaScript that loads products
  const scriptBlocks = html.match(/products_url|load_products|category_id|product_list/gi);
  console.log('Product-loading scripts:', scriptBlocks?.slice(0, 5));
  
  // Find where products container is
  const containerIdx = html.indexOf('items-container');
  if (containerIdx > -1) {
    console.log('\n=== PRODUCTS CONTAINER ===');
    console.log(html.substring(containerIdx - 50, containerIdx + 500));
  }
}

test().catch(console.error);
