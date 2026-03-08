import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const strength = searchParams.get('strength');
    const retailer = searchParams.get('retailer');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : null;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null;
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = (page - 1) * limit;
    const searchTerm = search ? `%${search}%` : null;

    // Count query
    const countResult = await sql`
      SELECT COUNT(*) as count FROM cs_cigars
      WHERE available = true
        AND (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${retailer}::text IS NULL OR retailer = ${retailer})
        AND (${minPrice}::numeric IS NULL OR price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm} OR description ILIKE ${searchTerm})
    `;
    const total = parseInt(countResult[0].count);

    // Fetch cigars
    const cigars = await sql`
      SELECT 
        id, name, brand, description, price, original_price, currency, url, image_url, 
        retailer, retailer_url, category, length_mm, ring_gauge, strength, format
      FROM cs_cigars 
      WHERE available = true
        AND (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${retailer}::text IS NULL OR retailer = ${retailer})
        AND (${minPrice}::numeric IS NULL OR price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm} OR description ILIKE ${searchTerm})
      ORDER BY brand, name
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      cigars,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });

  } catch (error) {
    console.error('Error fetching cigars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cigars' },
      { status: 500 }
    );
  }
}
