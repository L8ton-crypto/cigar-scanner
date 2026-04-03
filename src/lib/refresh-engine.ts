/**
 * Price refresh comparison engine
 * Loads existing prices, compares with scraped data, logs changes
 */

import { sql, ensureDb } from './db';
import { ScrapedProduct, ScrapingStats, normalise } from './scrapers/index';

interface ExistingPrice {
  price_id: number;
  product_id: number;
  price: string;
  url: string;
  source_name: string;
  product_name: string;
}

async function loadExistingPrices(retailerName: string) {
  await ensureDb();
  
  const prices = await sql`
    SELECT p.id as price_id, p.product_id, p.price, p.url, p.source_name,
           pr.name as product_name
    FROM cs_prices p
    JOIN cs_products pr ON pr.id = p.product_id
    WHERE p.retailer = ${retailerName}
  `;
  
  // Build lookup by normalised source name
  const lookup = new Map<string, ExistingPrice[]>();
  for (const p of prices as ExistingPrice[]) {
    const key = normalise(p.source_name || p.product_name);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(p);
  }
  
  return { prices: prices as ExistingPrice[], lookup };
}

export async function compareAndUpdate(
  retailerName: string, 
  scrapedProducts: ScrapedProduct[], 
  stats: ScrapingStats,
  dryRun = false
): Promise<ScrapingStats> {
  const { prices: existingPrices, lookup } = await loadExistingPrices(retailerName);
  const now = new Date();
  const seenPriceIds = new Set<number>();
  
  // Batch operations to avoid connection exhaustion
  const priceUpdates: Array<{ id: number; price: number }> = [];
  const verifyUpdates: number[] = [];
  const changeInserts: Array<{ productId: number; oldPrice: number; newPrice: number; type: string }> = [];
  
  for (const scraped of scrapedProducts) {
    const key = normalise(scraped.name);
    const matches = lookup.get(key) || [];
    
    if (matches.length > 0) {
      const existing = matches[0];
      seenPriceIds.add(existing.price_id);
      
      const oldPrice = parseFloat(existing.price);
      const newPrice = scraped.price;
      
      if (Math.abs(oldPrice - newPrice) > 0.01) {
        stats.pricesUpdated++;
        priceUpdates.push({ id: existing.price_id, price: newPrice });
        changeInserts.push({ 
          productId: existing.product_id, 
          oldPrice, 
          newPrice, 
          type: 'price_change' 
        });
      } else {
        verifyUpdates.push(existing.price_id);
      }
      stats.productsVerified++;
    }
  }
  
  // Execute batched writes
  if (!dryRun) {
    try {
      // Batch price updates in chunks of 50
      for (let i = 0; i < priceUpdates.length; i += 50) {
        const batch = priceUpdates.slice(i, i + 50);
        for (const u of batch) {
          try {
            await sql`UPDATE cs_prices SET price = ${u.price}, scraped_at = ${now}, last_verified = ${now} WHERE id = ${u.id}`;
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            stats.errors.push(`Update error: ${errorMessage.substring(0, 60)}`);
          }
        }
      }
      
      // Batch verify updates in chunks of 100
      for (let i = 0; i < verifyUpdates.length; i += 100) {
        const ids = verifyUpdates.slice(i, i + 100);
        try {
          await sql`UPDATE cs_prices SET last_verified = ${now} WHERE id = ANY(${ids})`;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          stats.errors.push(`Verify error: ${errorMessage.substring(0, 60)}`);
        }
      }
      
      // Batch change inserts
      for (const c of changeInserts) {
        try {
          await sql`INSERT INTO cs_price_changes (product_id, retailer, old_price, new_price, change_type, changed_at)
                    VALUES (${c.productId}, ${retailerName}, ${c.oldPrice}, ${c.newPrice}, ${c.type}, ${now})`;
        } catch (e) {
          // Ignore individual insert errors - not critical
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      stats.errors.push(`Database error: ${errorMessage}`);
    }
  }
  
  // Mark prices NOT seen in scrape as potentially removed
  const unseenPrices = existingPrices.filter(p => !seenPriceIds.has(p.price_id));
  stats.potentialRemovals = unseenPrices.length;
  
  // Don't auto-remove - just log. If >50% missing, the scrape probably failed.
  if (!dryRun && unseenPrices.length > 0 && unseenPrices.length < existingPrices.length * 0.5) {
    for (const removed of unseenPrices) {
      try {
        await sql`INSERT INTO cs_price_changes (product_id, retailer, old_price, new_price, change_type, changed_at)
                  VALUES (${removed.product_id}, ${retailerName}, ${removed.price}, ${null}, 'potential_removal', ${now})`;
      } catch (e) {
        // Ignore individual insert errors
      }
    }
  }
  
  return stats;
}

export async function recalcProductAggregates(dryRun = false): Promise<void> {
  if (!dryRun) {
    await ensureDb();
    try {
      await sql`
        UPDATE cs_products p SET 
          retailer_count = (SELECT COUNT(DISTINCT retailer) FROM cs_prices WHERE product_id = p.id),
          min_price = COALESCE((
            SELECT MIN(price) FROM cs_prices WHERE product_id = p.id 
            AND (LOWER(source_name) LIKE '%single%' OR (LOWER(source_name) NOT LIKE '%box of%' AND LOWER(source_name) NOT LIKE '%pack of%' AND LOWER(source_name) NOT LIKE '%bundle of%' AND LOWER(source_name) NOT LIKE '%cabinet of%'))
          ), p.min_price),
          max_price = COALESCE((
            SELECT MAX(price) FROM cs_prices WHERE product_id = p.id
            AND (LOWER(source_name) LIKE '%single%' OR (LOWER(source_name) NOT LIKE '%box of%' AND LOWER(source_name) NOT LIKE '%pack of%' AND LOWER(source_name) NOT LIKE '%bundle of%' AND LOWER(source_name) NOT LIKE '%cabinet of%'))
          ), p.max_price)
      `;
    } catch (e) {
      console.error('Error recalculating aggregates:', e);
    }
  }
}