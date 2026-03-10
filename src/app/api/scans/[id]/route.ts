import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
    const { id } = await params;

    const results = await sql`
      SELECT id, identification, matches, similar, thumbnail, created_at
      FROM cs_scans WHERE id = ${id}
    `;

    if (results.length === 0) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (error) {
    console.error('Error fetching scan:', error);
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 });
  }
}