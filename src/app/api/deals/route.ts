import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = (page - 1) * limit;
    const minSavings = searchParams.get('minSavings') ? parseFloat(searchParams.get('minSavings')!) : null;
    const brand = searchParams.get('brand');

    // Filter: max_price <= 3x min_price to exclude box vs single mismatches
    // Also require savings_pct <= 70% as sanity check
    const countResult = await sql`
      SELECT COUNT(*) as count FROM cs_products
      WHERE retailer_count > 1
        AND min_price IS NOT NULL
        AND max_price IS NOT NULL
        AND min_price > 0
        AND max_price > min_price
        AND max_price <= (min_price * 3)
        AND (${minSavings}::numeric IS NULL OR (max_price - min_price) >= ${minSavings})
        AND (${brand}::text IS NULL OR brand = ${brand})
    `;
    const total = parseInt(countResult[0].count as string);

    const products = await sql`
      SELECT id, name, brand, image_url, format, strength, min_price, max_price, retailer_count,
        (max_price - min_price) as savings,
        CASE WHEN max_price > 0 THEN ROUND(((max_price - min_price) / max_price) * 100, 1) ELSE 0 END as savings_pct
      FROM cs_products
      WHERE retailer_count > 1
        AND min_price IS NOT NULL
        AND max_price IS NOT NULL
        AND min_price > 0
        AND max_price > min_price
        AND max_price <= (min_price * 3)
        AND (${minSavings}::numeric IS NULL OR (max_price - min_price) >= ${minSavings})
        AND (${brand}::text IS NULL OR brand = ${brand})
      ORDER BY savings_pct DESC, (max_price - min_price) DESC, retailer_count DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      deals: products,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}
