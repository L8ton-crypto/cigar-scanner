import { NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET() {
  try {
    await ensureDb();

    const brands = await sql`
      SELECT 
        brand as name, 
        COUNT(*) as count
      FROM cs_cigars 
      WHERE available = true
      GROUP BY brand
      ORDER BY count DESC, brand ASC
    `;

    return NextResponse.json({ brands });

  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}