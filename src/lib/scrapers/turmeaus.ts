/**
 * Turmeaus scraper
 * HTML scraping with pagination and cigar filtering
 */

import { ScrapedProduct, decodeEntities, httpFetch, sleep, isCigar } from './index';

export async function scrapeTurmeaus(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  let page = 1;
  let consecutiveEmpty = 0;

  while (consecutiveEmpty < 2) {
    const html = await httpFetch(`https://www.turmeaus.co.uk/all_products.php?page=${page}`);
    if (!html) { 
      consecutiveEmpty++; 
      page++; 
      continue; 
    }

    const regex = /<div class="product-name"><a href="([^"]+)">([^<]+)<\/a><\/div>[\s\S]*?(?:<span class="new_price">£([\d,.]+)<\/span>|<span class="now_price">Online Price: <strong>£([\d,.]+)<\/strong>)/g;
    let match;
    let found = 0;
    
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const name = decodeEntities(match[2].trim());
      const price = parseFloat((match[3] || match[4]).replace(',', ''));
      
      if (price > 0 && isCigar(name)) {
        products.push({ 
          name, 
          price, 
          url, 
          retailer: 'Turmeaus', 
          retailerUrl: 'https://www.turmeaus.co.uk' 
        });
        found++;
      }
    }

    if (found === 0) { 
      consecutiveEmpty++; 
    } else { 
      consecutiveEmpty = 0; 
    }
    
    page++;
    await sleep(300);
  }

  return products;
}