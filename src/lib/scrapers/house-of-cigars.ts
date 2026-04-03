/**
 * House of Cigars scraper
 * WooCommerce store API
 */

import { ScrapedProduct } from './index';
import { scrapeWooCommerce } from './woocommerce';

export async function scrapeHouseOfCigars(): Promise<ScrapedProduct[]> {
  return scrapeWooCommerce(
    'https://www.thehouseofcigars.co.uk',
    'House of Cigars',
    'https://www.thehouseofcigars.co.uk'
  );
}