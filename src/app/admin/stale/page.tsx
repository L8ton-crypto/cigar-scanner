'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RetailerRow {
  retailer: string;
  totalPrices: number;
  stalePrices: number;
  brokenUrls: number;
  unverified30d: number;
  urlsChecked: number;
  lastUrlCheck: string | null;
}

interface BrokenRow {
  price_id: number;
  product_id: number;
  product_name: string;
  retailer: string;
  url: string;
  url_status: number;
  url_checked_at: string | null;
}

interface StaleReport {
  staleDays: number;
  totals: {
    totalPrices: number;
    stalePrices: number;
    brokenUrls: number;
    neverChecked: number;
    lastUrlCheck: string | null;
    hiddenProducts: number;
  };
  retailers: RetailerRow[];
  brokenSample: BrokenRow[];
}

function formatTime(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return '1 day ago';
  return `${diffD} days ago`;
}

export default function StaleAdminPage() {
  const [data, setData] = useState<StaleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Pass the ?key=... query from the current URL through to the API.
        // The page is reached at /admin/stale?key=<CRON_SECRET>.
        const pageKey = new URLSearchParams(window.location.search).get('key') || '';
        const qs = pageKey ? `?key=${encodeURIComponent(pageKey)}` : '';
        const res = await fetch(`/api/admin/stale-report${qs}`, { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Unauthorized - append ?key=<CRON_SECRET> to the URL');
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const j = await res.json();
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1a10] text-white">
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-[#c9a84c] hover:text-white transition-colors">
              Hearth &amp; Leaf
            </Link>
            <span className="text-sm text-[#8aaa7a]">Stale Detection</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/refresh" className="text-[#8aaa7a] hover:text-[#c9a84c]">Data Health</Link>
            <Link href="/" className="text-[#8aaa7a] hover:text-[#c9a84c]">← Home</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-2">Stale Product Detection</h1>
        <p className="text-[#8aaa7a] mb-8 text-sm">
          A price is hidden from public listings when its URL returns 4xx/5xx,
          or it hasn&apos;t been verified by the scraper in {data?.staleDays ?? 30} days.
        </p>

        {loading && <p className="text-[#8aaa7a]">Loading...</p>}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
            Failed to load: {error}
          </div>
        )}

        {data && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total prices" value={data.totals.totalPrices.toLocaleString()} />
              <StatCard
                label="Stale prices"
                value={data.totals.stalePrices.toLocaleString()}
                tone={data.totals.stalePrices > 0 ? 'warn' : 'ok'}
                hint={
                  data.totals.totalPrices > 0
                    ? `${((data.totals.stalePrices / data.totals.totalPrices) * 100).toFixed(1)}%`
                    : undefined
                }
              />
              <StatCard
                label="Broken URLs (4xx/5xx)"
                value={data.totals.brokenUrls.toLocaleString()}
                tone={data.totals.brokenUrls > 0 ? 'bad' : 'ok'}
              />
              <StatCard
                label="Hidden products"
                value={data.totals.hiddenProducts.toLocaleString()}
                tone={data.totals.hiddenProducts > 0 ? 'warn' : 'ok'}
                hint="no fresh prices left"
              />
            </section>

            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Per retailer</h2>
                <span className="text-xs text-[#8aaa7a]">
                  Last URL check: {formatTime(data.totals.lastUrlCheck)}
                </span>
              </div>
              <div className="overflow-x-auto bg-[#1a3a2a]/60 border border-[#c9a84c]/10 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="text-left text-[#8aaa7a] border-b border-[#c9a84c]/10">
                    <tr>
                      <th className="p-3">Retailer</th>
                      <th className="p-3 text-right">Prices</th>
                      <th className="p-3 text-right">Stale</th>
                      <th className="p-3 text-right">Broken URLs</th>
                      <th className="p-3 text-right">Unverified 30d+</th>
                      <th className="p-3 text-right">URLs checked</th>
                      <th className="p-3 text-right">Last check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.retailers.map((r) => {
                      const stalePct = r.totalPrices > 0 ? (r.stalePrices / r.totalPrices) * 100 : 0;
                      return (
                        <tr key={r.retailer} className="border-b border-[#c9a84c]/5 last:border-0">
                          <td className="p-3 font-medium">{r.retailer}</td>
                          <td className="p-3 text-right">{r.totalPrices.toLocaleString()}</td>
                          <td className={`p-3 text-right ${stalePct > 10 ? 'text-yellow-400' : ''}`}>
                            {r.stalePrices.toLocaleString()}
                            {stalePct > 0 && (
                              <span className="text-xs text-[#8aaa7a] ml-1">({stalePct.toFixed(1)}%)</span>
                            )}
                          </td>
                          <td className={`p-3 text-right ${r.brokenUrls > 0 ? 'text-red-400' : ''}`}>
                            {r.brokenUrls.toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-[#8aaa7a]">{r.unverified30d.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#8aaa7a]">{r.urlsChecked.toLocaleString()}</td>
                          <td className="p-3 text-right text-[#8aaa7a]">{formatTime(r.lastUrlCheck)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {data.brokenSample.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">Recent broken URLs</h2>
                <div className="overflow-x-auto bg-[#1a3a2a]/60 border border-[#c9a84c]/10 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[#8aaa7a] border-b border-[#c9a84c]/10">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3">Retailer</th>
                        <th className="p-3 text-right">Status</th>
                        <th className="p-3 text-right">Checked</th>
                        <th className="p-3">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.brokenSample.map((b) => (
                        <tr key={b.price_id} className="border-b border-[#c9a84c]/5 last:border-0">
                          <td className="p-3">
                            <Link href={`/cigar/${b.product_id}`} className="text-[#c9a84c] hover:underline">
                              {b.product_name}
                            </Link>
                          </td>
                          <td className="p-3 text-[#8aaa7a]">{b.retailer}</td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-1 rounded bg-red-900/40 text-red-300 text-xs">
                              {b.url_status}
                            </span>
                          </td>
                          <td className="p-3 text-right text-[#8aaa7a]">{formatTime(b.url_checked_at)}</td>
                          <td className="p-3 max-w-xs truncate">
                            <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-[#8aaa7a] hover:text-[#c9a84c] text-xs">
                              {b.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  hint?: string;
}) {
  const color =
    tone === 'bad' ? 'text-red-400' :
    tone === 'warn' ? 'text-yellow-400' :
    tone === 'ok' ? 'text-green-400' :
    'text-white';
  return (
    <div className="bg-[#1a3a2a]/60 border border-[#c9a84c]/10 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-[#8aaa7a]">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-xs text-[#8aaa7a] mt-1">{hint}</div>}
    </div>
  );
}
