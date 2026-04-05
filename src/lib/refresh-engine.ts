/**
 * Price refresh comparison engine
 * Loads existing prices, compares with scraped data, logs changes
 */

import { sql, ensureDb } from './db';
import { ScrapedProduct, ScrapingStats, normalise, isCigar } from './scrapers/index';

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

async function loadAllProducts() {
  await ensureDb();
  
  const products = await sql`
    SELECT id, name, brand FROM cs_products
  `;
  
  // Build lookup by normalised name for fuzzy matching
  const lookup = new Map<string, { id: number; name: string; brand: string }[]>();
  for (const p of products as any[]) {
    const key = normalise(p.name);
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)!.push(p);
  }
  
  return { products: products as any[], lookup };
}

function extractBrand(productName: string): string {
  // Simple brand extraction from common patterns
  const name = productName.trim();
  
  // Pattern: "Brand Name - Vitola Name"
  const dashMatch = name.match(/^([^-]+)\s*-/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }
  
  // Pattern: First 1-2 words
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    // Check if first two words make sense as a brand
    const firstTwo = words.slice(0, 2).join(' ');
    if (firstTwo.length <= 20) {
      return firstTwo;
    }
  }
  
  // Fallback to first word
  return words[0] || 'Unknown';
}

function fuzzyMatch(scrapedName: string, productLookup: Map<string, any[]>): any | null {
  const normalized = normalise(scrapedName);
  
  // Try exact match first
  if (productLookup.has(normalized)) {
    return productLookup.get(normalized)![0];
  }
  
  // Try without trailing words
  const words = normalized.split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    const partial = words.slice(0, i).join(' ');
    if (productLookup.has(partial)) {
      return productLookup.get(partial)![0];
    }
  }
  
  // Try substring matching
  for (const [key, products] of productLookup) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return products[0];
    }
  }
  
  return null;
}

export async function compareAndUpdate(
  retailerName: string, 
  scrapedProducts: ScrapedProduct[], 
  stats: ScrapingStats,
  dryRun = false,
  maxNewProductsPerRun = 50
): Promise<ScrapingStats> {
  const { prices: existingPrices, lookup } = await loadExistingPrices(retailerName);
  const { products: allProducts, lookup: productLookup } = await loadAllProducts();
  const now = new Date();
  const seenPriceIds = new Set<number>();
  
  // Batch operations to avoid connection exhaustion
  const priceUpdates: Array<{ id: number; price: number }> = [];
  const verifyUpdates: number[] = [];
  const changeInserts: Array<{ productId: number; oldPrice: number; newPrice: number; type: string }> = [];
  const newProductInserts: Array<{ name: string; brand: string; price: number; scraped: ScrapedProduct }> = [];
  
  for (const scraped of scrapedProducts) {
    const key = normalise(scraped.name);
    const matches = lookup.get(key) || [];
    
    if (matches.length > 0) {
      // Existing product found
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
    } else {
      // No exact match found - try fuzzy matching
      const fuzzyMatch_ = fuzzyMatch(scraped.name, productLookup);
      
      if (fuzzyMatch_) {
        // Fuzzy match found - treat as existing product
        // Look for existing price entry for this product and retailer
        const existingPriceForProduct = existingPrices.find(p => p.product_id === fuzzyMatch_.id);
        
        if (existingPriceForProduct) {
          seenPriceIds.add(existingPriceForProduct.price_id);
          
          const oldPrice = parseFloat(existingPriceForProduct.price);
          const newPrice = scraped.price;
          
          if (Math.abs(oldPrice - newPrice) > 0.01) {
            stats.pricesUpdated++;
            priceUpdates.push({ id: existingPriceForProduct.price_id, price: newPrice });
            changeInserts.push({ 
              productId: fuzzyMatch_.id, 
              oldPrice, 
              newPrice, 
              type: 'price_change' 
            });
          } else {
            verifyUpdates.push(existingPriceForProduct.price_id);
          }
        } else {
          // Product exists but no price from this retailer - add new price
          stats.pricesAdded++;
          newProductInserts.push({
            name: fuzzyMatch_.name,
            brand: fuzzyMatch_.brand,
            price: scraped.price,
            scraped: { ...scraped, productId: fuzzyMatch_.id }
          } as any);
        }
        stats.productsVerified++;
      } else {
        // Truly new product - check if it's actually a cigar and within safety limits
        if (isCigar(scraped.name) && newProductInserts.length < maxNewProductsPerRun) {
          const brand = extractBrand(scraped.name);
          newProductInserts.push({
            name: scraped.name,
            brand,
            price: scraped.price,
            scraped
          });
          stats.newProducts++;
        }
      }
    }
  }
  
  // Execute batched writes
  if (!dryRun) {
    try {
      // Handle new products first
      for (const newProd of newProductInserts) {
        try {
          let productId: number;
          
          if ('productId' in newProd.scraped) {
            // Existing product, new price entry
            productId = (newProd.scraped as any).productId;
          } else {
            // Truly new product
            const productResult = await sql`
              INSERT INTO cs_products (name, brand, created_at)
              VALUES (${newProd.name}, ${newProd.brand}, ${now})
              RETURNING id
            `;
            productId = productResult[0].id as number;
            
            // Log as new product in price changes
            await sql`INSERT INTO cs_price_changes (product_id, retailer, old_price, new_price, change_type, changed_at)
                      VALUES (${productId}, ${retailerName}, ${null}, ${newProd.price}, 'new_product', ${now})`;
          }
          
          // Insert price
          await sql`
            INSERT INTO cs_prices (product_id, retailer, retailer_url, price, currency, available, url, source_name, scraped_at, last_verified)
            VALUES (${productId}, ${retailerName}, ${newProd.scraped.retailerUrl}, ${newProd.price}, 'GBP', true, ${newProd.scraped.url}, ${newProd.scraped.name}, ${now}, ${now})
          `;
          stats.pricesAdded++;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          stats.errors.push(`New product error: ${errorMessage.substring(0, 60)}`);
        }
      }
      
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
      
      // Log warning if too many new products found
      if (newProductInserts.length >= maxNewProductsPerRun) {
        stats.errors.push(`Warning: ${newProductInserts.length}+ new products found for ${retailerName} - possible matching issue`);
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