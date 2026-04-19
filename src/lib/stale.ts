/**
 * Stale product detection (task-51)
 *
 * A price is considered stale when:
 *   - last_verified IS NOT NULL AND last_verified is older than STALE_DAYS, OR
 *   - url_status IS NOT NULL AND url_status >= 400 (URL returned an error on last check)
 *
 * NULL last_verified is treated as fresh (legacy data pre-refresh engine).
 *
 * NOTE: The 30-day window is also hardcoded as `INTERVAL '30 days'` in the
 * SQL files that do the filtering (refresh-engine, cigars/[id], stale-report).
 * If you change STALE_DAYS, update those too.
 */

export const STALE_DAYS = 30;

export function isStale(row: {
  last_verified: Date | string | null;
  url_status: number | null;
}): boolean {
  if (row.url_status != null && row.url_status >= 400) return true;
  if (row.last_verified == null) return false;
  const lv = typeof row.last_verified === 'string'
    ? new Date(row.last_verified)
    : row.last_verified;
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  return lv.getTime() <= cutoff;
}

/**
 * HEAD/GET a URL with a per-attempt timeout and return the HTTP status.
 * Falls back to GET with Range: bytes=0-0 if HEAD is disallowed (405 / 403)
 * or fails at the network layer. Returns null only on both attempts failing
 * so callers can distinguish "unknown" (network error) from "definitely 404".
 * 3xx is treated as healthy (retailers often redirect to canonical product URL).
 */
export async function checkUrlStatus(url: string, timeoutMs = 8000): Promise<number | null> {
  const headers: HeadersInit = {
    // Some retailers block default fetch UAs
    'User-Agent':
      'Mozilla/5.0 (compatible; CigarScannerBot/1.0; +https://cigar-scanner.vercel.app)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  async function doFetch(method: 'HEAD' | 'GET', extra: HeadersInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { ...headers, ...extra },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Try HEAD first
  let headStatus: number | null = null;
  try {
    const res = await doFetch('HEAD');
    // 405 Method Not Allowed / 403 Forbidden often means HEAD is blocked - retry with GET
    if (res.status !== 405 && res.status !== 403) {
      return res.status;
    }
    headStatus = res.status;
  } catch {
    // Network error on HEAD - fall through to GET
  }

  // GET fallback with Range: bytes=0-0 to minimise bytes transferred
  try {
    const res = await doFetch('GET', { Range: 'bytes=0-0' });
    return res.status;
  } catch {
    // Both attempts failed at the network layer
    return headStatus;
  }
}
