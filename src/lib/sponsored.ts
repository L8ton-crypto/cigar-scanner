import { sql } from './db';

export interface SponsoredRow {
  id: number;
  product_id: number;
  sponsor_name: string | null;
  notes: string | null;
  weight: number;
  active: boolean;
  start_at: string;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipInfo {
  sponsor_name: string | null;
}

/**
 * Fetch the active sponsorships keyed by product_id.
 * "Active" = active=true AND start_at <= now AND (end_at is null OR end_at > now).
 *
 * If a product has multiple active rows, the highest-weight (then most recent) wins.
 * Returns an empty Map if no rows match - the badge then renders nowhere,
 * which is the intended state until L8 inserts a row.
 */
export async function getActiveSponsorshipMap(
  productIds: number[]
): Promise<Map<number, SponsorshipInfo>> {
  const map = new Map<number, SponsorshipInfo>();
  if (productIds.length === 0) return map;

  // DISTINCT ON keeps the first row per product_id under the ORDER BY.
  const rows = await sql`
    SELECT DISTINCT ON (product_id) product_id, sponsor_name
    FROM cs_sponsored
    WHERE active = true
      AND start_at <= NOW()
      AND (end_at IS NULL OR end_at > NOW())
      AND product_id = ANY(${productIds})
    ORDER BY product_id, weight DESC, created_at DESC
  ` as Array<{ product_id: number; sponsor_name: string | null }>;

  for (const r of rows) {
    map.set(Number(r.product_id), { sponsor_name: r.sponsor_name });
  }
  return map;
}

/**
 * Lighter helper for product detail page - one product, one lookup.
 */
export async function getActiveSponsorship(
  productId: number
): Promise<SponsorshipInfo | null> {
  const rows = await sql`
    SELECT sponsor_name
    FROM cs_sponsored
    WHERE active = true
      AND product_id = ${productId}
      AND start_at <= NOW()
      AND (end_at IS NULL OR end_at > NOW())
    ORDER BY weight DESC, created_at DESC
    LIMIT 1
  ` as Array<{ sponsor_name: string | null }>;
  if (rows.length === 0) return null;
  return { sponsor_name: rows[0].sponsor_name };
}

/**
 * Bearer auth shared by all admin sponsored endpoints.
 * Uses CRON_SECRET to keep parity with /api/admin/check-urls and stale-report.
 */
export function checkSponsoredAdminAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === secret) {
    return true;
  }
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  return key === secret;
}
