import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';
import { checkSponsoredAdminAuth } from '@/lib/sponsored';

export const dynamic = 'force-dynamic';

/**
 * PATCH  /api/admin/sponsored/[id]     - partial update (active, weight, end_at, notes, sponsor_name)
 * DELETE /api/admin/sponsored/[id]     - hard delete
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  or  ?key=<CRON_SECRET>
 */

interface PatchBody {
  sponsor_name?: unknown;
  notes?: unknown;
  weight?: unknown;
  active?: unknown;
  start_at?: unknown;
  end_at?: unknown;
}

function parseDateOrUndef(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return undefined; // ignore garbage
  return d.toISOString();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkSponsoredAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureDb();
    const { id } = await params;
    const rowId = parseInt(id, 10);
    if (!rowId || isNaN(rowId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;

    const sponsorName =
      body.sponsor_name === undefined
        ? undefined
        : body.sponsor_name === null || body.sponsor_name === ''
          ? null
          : String(body.sponsor_name).trim().slice(0, 200);

    const notes =
      body.notes === undefined
        ? undefined
        : body.notes === null || body.notes === ''
          ? null
          : String(body.notes).trim().slice(0, 1000);

    const weight =
      body.weight === undefined
        ? undefined
        : Math.max(1, Math.min(1000, Number(body.weight) || 1));

    const active = body.active === undefined ? undefined : Boolean(body.active);
    const startAt = parseDateOrUndef(body.start_at);
    const endAt = parseDateOrUndef(body.end_at);

    // Use COALESCE to keep current values when a field is undefined.
    // Empty string and null on dates clear them.
    const updated = await sql`
      UPDATE cs_sponsored SET
        sponsor_name = CASE WHEN ${sponsorName === undefined}::boolean THEN sponsor_name ELSE ${sponsorName} END,
        notes        = CASE WHEN ${notes === undefined}::boolean THEN notes ELSE ${notes} END,
        weight       = CASE WHEN ${weight === undefined}::boolean THEN weight ELSE ${weight} END,
        active       = CASE WHEN ${active === undefined}::boolean THEN active ELSE ${active} END,
        start_at     = CASE WHEN ${startAt === undefined}::boolean THEN start_at ELSE ${startAt}::timestamptz END,
        end_at       = CASE WHEN ${endAt === undefined}::boolean THEN end_at ELSE ${endAt}::timestamptz END,
        updated_at   = NOW()
      WHERE id = ${rowId}
      RETURNING id, product_id, sponsor_name, notes, weight, active,
                start_at, end_at, created_at, updated_at
    `;

    if (updated.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ sponsored: updated[0] });
  } catch (err) {
    console.error('PATCH /api/admin/sponsored/[id]:', err);
    return NextResponse.json({ error: 'Failed to update sponsored row' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkSponsoredAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await ensureDb();
    const { id } = await params;
    const rowId = parseInt(id, 10);
    if (!rowId || isNaN(rowId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM cs_sponsored WHERE id = ${rowId} RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: deleted[0].id });
  } catch (err) {
    console.error('DELETE /api/admin/sponsored/[id]:', err);
    return NextResponse.json({ error: 'Failed to delete sponsored row' }, { status: 500 });
  }
}
