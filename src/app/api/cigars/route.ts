import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const strength = searchParams.get('strength');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : null;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null;
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'brand-asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = (page - 1) * limit;
    const searchTerm = search ? `%${search}%` : null;

    // Validate sort param
    const validSorts = ['price-asc', 'price-desc', 'name-asc', 'name-desc', 'retailers-desc', 'savings-desc', 'brand-asc'];
    const validSort = validSorts.includes(sort) ? sort : 'brand-asc';

    const countResult = await sql`
      SELECT COUNT(*) as count FROM cs_products
      WHERE (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${minPrice}::numeric IS NULL OR min_price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR min_price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
    `;
    const total = parseInt(countResult[0].count);

    const products = await sql`
      SELECT id, name, brand, image_url, format, strength,
             min_price, max_price, retailer_count
      FROM cs_products 
      WHERE (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${minPrice}::numeric IS NULL OR min_price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR min_price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
      ORDER BY
        CASE WHEN ${validSort} = 'price-asc' THEN min_price END ASC NULLS LAST,
        CASE WHEN ${validSort} = 'price-desc' THEN min_price END DESC NULLS LAST,
        CASE WHEN ${validSort} = 'name-asc' THEN name END ASC,
        CASE WHEN ${validSort} = 'name-desc' THEN name END DESC,
        CASE WHEN ${validSort} = 'retailers-desc' THEN retailer_count END DESC NULLS LAST,
        CASE WHEN ${validSort} = 'savings-desc' THEN COALESCE(max_price, 0) - COALESCE(min_price, 0) END DESC NULLS LAST,
        CASE WHEN ${validSort} = 'brand-asc' THEN brand END ASC,
        name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      cigars: products,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });
  } catch (error) {
    console.error('Error fetching cigars:', error);
    return NextResponse.json({ error: 'Failed to fetch cigars' }, { status: 500 });
  }
}
