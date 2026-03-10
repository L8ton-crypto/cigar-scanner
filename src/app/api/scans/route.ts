import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

function generateId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    const body = await request.json();
    const { identification, matches, similar, thumbnail } = body;

    if (!identification) {
      return NextResponse.json({ error: 'No identification data' }, { status: 400 });
    }

    const id = generateId();

    await sql`
      INSERT INTO cs_scans (id, identification, matches, similar, thumbnail)
      VALUES (
        ${id},
        ${JSON.stringify(identification)},
        ${JSON.stringify(matches || [])},
        ${JSON.stringify(similar || [])},
        ${thumbnail || null}
      )
    `;

    return NextResponse.json({ id, url: `/scan/${id}` });
  } catch (error) {
    console.error('Error saving scan:', error);
    return NextResponse.json({ error: 'Failed to save scan' }, { status: 500 });
  }
}