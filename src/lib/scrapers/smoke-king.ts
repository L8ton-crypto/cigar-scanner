/**
 * Smoke King scraper
 * Shopify JSON API
 */

import { ScrapedProduct, httpFetchJson, sleep } from './index';

export async function scrapeSmokingKing(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  let page = 1;

  while (true) {
    const data = await httpFetchJson(`https://www.smoke-king.co.uk/collections/cigars/products.json?limit=250&page=${page}`);
    
    if (!data || !data.products || !Array.isArray(data.products) || data.products.length === 0) {
      break;
    }

    for (const p of data.products) {
      const price = p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null;
      if (!price || !p.handle) continue;
      
      products.push({
        name: p.title,
        price,
        url: `https://www.smoke-king.co.uk/products/${p.handle}`,
        retailer: 'Smoke King',
        retailerUrl: 'https://www.smoke-king.co.uk'
      });
    }

    if (data.products.length < 250) break;
    page++;
    await sleep(500);
  }

  return products;
}