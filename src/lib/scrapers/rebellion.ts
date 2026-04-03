/**
 * Rebellion scraper
 * HTML scraping with regex patterns
 */

import { ScrapedProduct, decodeEntities, httpFetch, sleep } from './index';

export async function scrapeRebellion(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const seen = new Set<string>();
  let page = 1;

  while (true) {
    const html = await httpFetch(`https://www.rebellioncigars.co.uk/search/products?keywords=&page=${page}`);
    if (!html) break;

    // Match full-URL pattern (site returns absolute URLs now)
    const regex = /item-heading"><a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>[\s\S]*?<span class="price">\s*&pound;([\d,.]+)/g;
    let match;
    let found = 0;
    
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (seen.has(url)) continue; // Dedupe grid/list views
      seen.add(url);
      
      const name = decodeEntities(match[2].trim());
      const price = parseFloat(match[3].replace(',', ''));
      
      if (price > 0) {
        products.push({ 
          name, 
          price, 
          url, 
          retailer: 'Rebellion', 
          retailerUrl: 'https://www.rebellioncigars.co.uk' 
        });
        found++;
      }
    }

    if (found === 0) break;
    page++;
    await sleep(500);
  }

  return products;
}