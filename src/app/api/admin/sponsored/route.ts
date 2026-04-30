import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';
import { checkSponsoredAdminAuth } from '@/lib/sponsored';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/admin/sponsored             - list all sponsored rows (newest first)
 * POST /api/admin/sponsored             - create a sponsored row
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  ?key=<CRON_SECRET>
 */

export async function GET(request: NextRequest) {
  if (!checkSponsoredAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureDb();
    const rows = await sql`
      SELECT
        s.id,
        s.product_id,
        p.name        AS product_name,
        p.brand       AS product_brand,
        s.sponsor_name,
        s.notes,
        s.weight,
        s.active,
        s.start_at,
        s.end_at,
        s.created_at,
        s.updated_at,
        (s.active = true
          AND s.start_at <= NOW()
          AND (s.end_at IS NULL OR s.end_at > NOW())) AS is_live
      FROM cs_sponsored s
      LEFT JOIN cs_products p ON p.id = s.product_id
      ORDER BY s.active DESC, s.created_at DESC
    `;
    return NextResponse.json({ sponsored: rows });
  } catch (err) {
    console.error('GET /api/admin/sponsored:', err);
    return NextResponse.json({ error: 'Failed to list sponsored rows' }, { status: 500 });
  }
}

interface CreateBody {
  product_id?: unknown;
  sponsor_name?: unknown;
  notes?: unknown;
  weight?: unknown;
  active?: unknown;
  start_at?: unknown;
  end_at?: unknown;
}

function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(request: NextRequest) {
  if (!checkSponsoredAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureDb();
    const body = (await request.json()) as CreateBody;

    const productId = Number(body.product_id);
    if (!productId || isNaN(productId)) {
      return NextResponse.json({ error: 'product_id required' }, { status: 400 });
    }

    const product = await sql`
      SELECT id FROM cs_products WHERE id = ${productId} LIMIT 1
    `;
    if (product.length === 0) {
      return NextResponse.json({ error: 'product_id does not exist' }, { status: 400 });
    }

    const sponsorName =
      typeof body.sponsor_name === 'string' && body.sponsor_name.trim()
        ? body.sponsor_name.trim().slice(0, 200)
        : null;
    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim().slice(0, 1000)
        : null;
    const weight = Math.max(1, Math.min(1000, Number(body.weight) || 1));
    const active = body.active === undefined ? true : Boolean(body.active);
    const startAt = parseDate(body.start_at);
    const endAt = parseDate(body.end_at);

    const inserted = await sql`
      INSERT INTO cs_sponsored
        (product_id, sponsor_name, notes, weight, active, start_at, end_at)
      VALUES
        (${productId}, ${sponsorName}, ${notes}, ${weight}, ${active},
         COALESCE(${startAt}::timestamptz, NOW()),
         ${endAt}::timestamptz)
      RETURNING id, product_id, sponsor_name, notes, weight, active,
                start_at, end_at, created_at, updated_at
    `;
    return NextResponse.json({ sponsored: inserted[0] }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/sponsored:', err);
    return NextResponse.json({ error: 'Failed to create sponsored row' }, { status: 500 });
  }
}
