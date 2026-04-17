import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';
import { parseDimensionsFromName } from '@/lib/cigar-dimensions';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

async function runPopulate(request: NextRequest) {
  await ensureDb();

    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '500', 10) || 500,
      2000
    );
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const force = url.searchParams.get('force') === 'true';

    const rows = force
      ? await sql`
          SELECT id, name, description, length_mm, ring_gauge
          FROM cs_products
          ORDER BY id
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, name, description, length_mm, ring_gauge
          FROM cs_products
          WHERE length_mm IS NULL OR ring_gauge IS NULL
          ORDER BY id
          LIMIT ${limit}
        `;

    const stats = {
      total: rows.length,
      updatedLength: 0,
      updatedRing: 0,
      matchedExplicit: 0,
      matchedVitola: 0,
      matchedDescription: 0,
      unmatched: 0,
      updated: 0,
    };

    const sample: Array<{ id: number; name: string; length_mm: number | null; ring_gauge: number | null; vitola: string | null; source: string | null }> = [];

    for (const row of rows) {
      const parsed = parseDimensionsFromName(row.name as string, row.description as string | null);

      const newLength = row.length_mm ?? parsed.length_mm;
      const newRing = row.ring_gauge ?? parsed.ring_gauge;

      // When forcing, always prefer explicit / description-derived values
      const finalLength = force && parsed.length_mm ? parsed.length_mm : newLength;
      const finalRing = force && parsed.ring_gauge ? parsed.ring_gauge : newRing;

      const changed =
        finalLength !== row.length_mm || finalRing !== row.ring_gauge;

      if (changed) {
        if (finalLength !== row.length_mm && finalLength != null) stats.updatedLength++;
        if (finalRing !== row.ring_gauge && finalRing != null) stats.updatedRing++;
        stats.updated++;

        if (!dryRun) {
          await sql`
            UPDATE cs_products
            SET length_mm = ${finalLength ?? null},
                ring_gauge = ${finalRing ?? null}
            WHERE id = ${row.id}
          `;
        }
      }

      if (parsed.source === 'explicit') stats.matchedExplicit++;
      else if (parsed.source === 'vitola') stats.matchedVitola++;
      else if (parsed.source === 'description') stats.matchedDescription++;
      else stats.unmatched++;

      if (sample.length < 20 && changed) {
        sample.push({
          id: row.id as number,
          name: row.name as string,
          length_mm: finalLength,
          ring_gauge: finalRing,
          vitola: parsed.vitola,
          source: parsed.source,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      force,
      limit,
      processed: rows.length,
      ...stats,
      sample,
    });
}

/**
 * POST /api/admin/populate-dimensions
 *
 * Backfill length_mm / ring_gauge on cs_products using the dimension parser.
 * Auth: Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   - limit  (number, default 500, max 2000)
 *   - dryRun (boolean, default false)
 *   - force  (boolean, default false)
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await runPopulate(request);
  } catch (error) {
    console.error('populate-dimensions POST error:', error);
    return NextResponse.json({ error: 'Failed to populate dimensions' }, { status: 500 });
  }
}

/**
 * GET /api/admin/populate-dimensions
 *
 * - Without ?run=true, returns coverage stats only.
 * - With ?run=true, runs the populate (used by Vercel cron which fires GET).
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(request.url);
    if (url.searchParams.get('run') === 'true') {
      return await runPopulate(request);
    }
    await ensureDb();
    const stats = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(length_mm)::int AS with_length,
        COUNT(ring_gauge)::int AS with_ring,
        COUNT(CASE WHEN length_mm IS NOT NULL AND ring_gauge IS NOT NULL THEN 1 END)::int AS with_both
      FROM cs_products
    `;
    return NextResponse.json({ success: true, stats: stats[0] });
  } catch (error) {
    console.error('populate-dimensions GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
