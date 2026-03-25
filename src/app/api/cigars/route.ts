import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureDb } from '@/lib/db';

const sortMap: Record<string, string> = {
  'price-asc': 'min_price ASC NULLS LAST, name ASC',
  'price-desc': 'min_price DESC NULLS LAST, name ASC',
  'name-asc': 'name ASC',
  'name-desc': 'name DESC',
  'retailers-desc': 'retailer_count DESC NULLS LAST, name ASC',
  'savings-desc': '(COALESCE(max_price, 0) - COALESCE(min_price, 0)) DESC NULLS LAST, name ASC',
  'brand-asc': 'brand ASC, name ASC',
};

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const sql = getDb();
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

    // Validate sort - only allow known keys (prevents SQL injection)
    const orderBy = sortMap[sort] || sortMap['brand-asc'];

    const countResult = await sql`
      SELECT COUNT(*) as count FROM cs_products
      WHERE (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${minPrice}::numeric IS NULL OR min_price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR min_price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
    `;
    const total = parseInt(countResult[0].count);

    // Build WHERE clause params
    const whereClause = `
      WHERE ($1::text IS NULL OR brand = $1)
        AND ($2::text IS NULL OR strength = $2)
        AND ($3::numeric IS NULL OR min_price >= $3)
        AND ($4::numeric IS NULL OR min_price <= $4)
        AND ($5::text IS NULL OR name ILIKE $5 OR brand ILIKE $5)
    `;
    const params = [brand, strength, minPrice, maxPrice, searchTerm, limit, offset];

    // Use function-call mode for dynamic ORDER BY (orderBy is from allowlist, safe)
    const query = `
      SELECT id, name, brand, image_url, format, strength,
             min_price, max_price, retailer_count
      FROM cs_products
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $6 OFFSET $7
    `;

    const products = await (sql as unknown as (query: string, params: unknown[]) => Promise<Record<string, unknown>[]>)(query, params);

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
