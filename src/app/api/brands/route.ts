import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const brands = await sql`
      SELECT brand as name, COUNT(*) as count
      FROM cs_products
      GROUP BY brand
      ORDER BY brand
    `;

    return NextResponse.json({ brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 });
  }
}
