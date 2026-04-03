/**
 * Shared WooCommerce scraper for multiple retailers
 */

import { ScrapedProduct, decodeEntities, httpFetchJson, sleep } from './index';

export async function scrapeWooCommerce(
  baseUrl: string,
  retailerName: string,
  retailerUrl: string,
  filter?: (product: any) => boolean
): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${baseUrl}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
    const data = await httpFetchJson(url);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      break;
    }

    for (const p of data) {
      if (filter && !filter(p)) continue;
      
      const name = decodeEntities(p.name);
      const price = p.prices?.price
        ? parseInt(p.prices.price) / Math.pow(10, p.prices.currency_minor_unit || 2)
        : null;
      
      if (!price || !p.permalink) continue;
      
      products.push({
        name,
        price,
        url: p.permalink,
        retailer: retailerName,
        retailerUrl
      });
    }

    if (data.length < perPage) break;
    page++;
    await sleep(800);
  }

  return products;
}