import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const strength = searchParams.get('strength');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = ['available = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (brand) {
      conditions.push(`brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    if (strength) {
      conditions.push(`strength = $${paramIndex}`);
      params.push(strength);
      paramIndex++;
    }

    if (minPrice) {
      conditions.push(`price >= $${paramIndex}`);
      params.push(parseFloat(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      conditions.push(`price <= $${paramIndex}`);
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR brand ILIKE $${paramIndex + 1} OR description ILIKE $${paramIndex + 2})`);
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
      paramIndex += 3;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM cs_cigars ${whereClause}`;
    const countResult = await sql.query(countQuery, params);
    const total = parseInt(countResult[0].count);

    // Get cigars
    const cigarsQuery = `
      SELECT 
        id, name, brand, description, price, currency, url, image_url, 
        retailer, length_mm, ring_gauge, strength, format
      FROM cs_cigars 
      ${whereClause}
      ORDER BY brand, name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const cigars = await sql.query(cigarsQuery, [...params, limit, offset]);

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      cigars,
      total,
      page,
      pages,
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