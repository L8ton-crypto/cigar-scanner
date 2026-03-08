import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();

    const resolvedParams = await params;
    const cigarId = parseInt(resolvedParams.id);
    
    if (isNaN(cigarId)) {
      return NextResponse.json(
        { error: 'Invalid cigar ID' },
        { status: 400 }
      );
    }

    const cigars = await sql`
      SELECT 
        id, name, brand, description, price, currency, url, image_url,
        retailer, length_mm, ring_gauge, strength, format, country,
        created_at
      FROM cs_cigars 
      WHERE id = ${cigarId} AND available = true
    `;

    if (cigars.length === 0) {
      return NextResponse.json(
        { error: 'Cigar not found' },
        { status: 404 }
      );
    }

    const cigar = cigars[0];

    // Get related cigars (same brand or similar format)
    const related = await sql`
      SELECT id, name, brand, price, image_url, strength, format
      FROM cs_cigars 
      WHERE (brand = ${cigar.brand} OR format = ${cigar.format})
      AND id != ${cigarId}
      AND available = true
      ORDER BY 
        CASE WHEN brand = ${cigar.brand} THEN 1 ELSE 2 END,
        price
      LIMIT 6
    `;

    return NextResponse.json({
      cigar,
      related
    });

  } catch (error) {
    console.error('Error fetching cigar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cigar' },
      { status: 500 }
    );
  }
}