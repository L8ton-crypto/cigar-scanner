import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getActiveSponsorship } from '@/lib/sponsored';
import { calculatePricePerInch, parsePackCount } from '@/lib/cigar-dimensions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Get the product
    const products = await sql`
      SELECT id, name, brand, description, image_url, format, strength, country,
             length_mm, ring_gauge, min_price, max_price, retailer_count
      FROM cs_products WHERE id = ${productId}
    `;

    if (products.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // Get all prices for this product, excluding stale ones
    // (last_verified > 30 days ago, or url_status returned 4xx/5xx).
    const prices = await sql`
      SELECT retailer, retailer_url, price, original_price, currency, available, url, source_name
      FROM cs_prices
      WHERE product_id = ${productId}
        AND (last_verified IS NULL OR last_verified > NOW() - INTERVAL '30 days')
        AND (url_status IS NULL OR url_status < 400)
      ORDER BY price ASC
    `;

    // Get price history for the last 90 days
    const priceHistoryRaw = await sql`
      SELECT retailer, price, recorded_at::date as date
      FROM cs_price_history
      WHERE product_id = ${productId}
      AND recorded_at > NOW() - INTERVAL '90 days'
      ORDER BY retailer, recorded_at
    `;

    // Group price history by retailer
    const priceHistoryMap = new Map<string, Array<{ date: string; price: number }>>();
    for (const row of priceHistoryRaw) {
      if (!priceHistoryMap.has(row.retailer)) {
        priceHistoryMap.set(row.retailer, []);
      }
      priceHistoryMap.get(row.retailer)!.push({
        date: row.date,
        price: Number(row.price)
      });
    }

    const priceHistory = Array.from(priceHistoryMap.entries()).map(([retailer, data]) => ({
      retailer,
      data
    }));

    // Get related products (same brand)
    const related = await sql`
      SELECT id, name, brand, image_url, min_price, strength, format, retailer_count
      FROM cs_products 
      WHERE brand = ${product.brand} AND id != ${productId}
      ORDER BY name
      LIMIT 6
    `;

    // Compute price-per-inch per retailer when dimensions are known.
    // We infer pack count from each retailer's source_name when available,
    // falling back to the canonical product name.
    const lengthMm = product.length_mm ? Number(product.length_mm) : null;
    const pricesEnriched = prices.map((p) => {
      const nameForPack = (p.source_name as string | null) || (product.name as string);
      const pack = parsePackCount(nameForPack);
      const pricePerInch = lengthMm
        ? calculatePricePerInch(Number(p.price), lengthMm, pack.count)
        : null;
      return {
        ...p,
        pack_count: pack.count,
        pack_kind: pack.kind,
        price_per_inch: pricePerInch,
      };
    });

    let bestPricePerInch: number | null = null;
    for (const p of pricesEnriched) {
      if (p.price_per_inch != null && (bestPricePerInch == null || p.price_per_inch < bestPricePerInch)) {
        bestPricePerInch = p.price_per_inch;
      }
    }

    const sponsorship = await getActiveSponsorship(productId);

    return NextResponse.json({
      cigar: {
        ...product,
        best_price_per_inch: bestPricePerInch,
        sponsored: !!sponsorship,
        sponsor_name: sponsorship ? sponsorship.sponsor_name : null,
      },
      prices: pricesEnriched,
      related,
      priceHistory,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
