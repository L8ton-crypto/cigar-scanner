/**
 * Sautter scraper
 * WooCommerce store API with category filtering
 */

import { ScrapedProduct } from './index';
import { scrapeWooCommerce } from './woocommerce';

const EXCLUDED_CATEGORIES = [
  'Accessories', 'Ashtrays', 'Candles', 'Cutters', 'Lighters', 'Humidors',
  'Cases', 'Pouches', 'Lifestyle', 'Art', 'Books', 'Writing', 'Clothing',
  'Private Purchases', 'Spirits', 'Whisky', 'Rum', 'Gin', 'Wine',
  'Coffee', 'Chocolate', 'Gift Sets', 'Vouchers', 'Membership'
];

export async function scrapeSautter(): Promise<ScrapedProduct[]> {
  return scrapeWooCommerce(
    'https://www.sauttercigars.com',
    'Sautter',
    'https://www.sauttercigars.com',
    (product) => {
      const cats = (product.categories || []).map((c: any) => c.name);
      return !cats.every((name: string) =>
        EXCLUDED_CATEGORIES.some(exc => name.toLowerCase().includes(exc.toLowerCase()))
      );
    }
  );
}