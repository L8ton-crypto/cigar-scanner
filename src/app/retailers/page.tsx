import Link from 'next/link';
import { Metadata } from 'next';
import { getAllRetailerTrust, getTrustBand } from '@/lib/retailer-trust';
import { TrustBadge } from '@/components/TrustBadge';

export const metadata: Metadata = {
  title: 'UK Cigar Retailers — Trust Scores | CigarScanner',
  description: 'Trustpilot scores and reviews for every UK cigar retailer tracked by CigarScanner. Shop with confidence.',
  openGraph: {
    title: 'UK Cigar Retailers — Trust Scores',
    description: 'Trustpilot scores and reviews for every UK cigar retailer tracked by CigarScanner.',
    type: 'website'
  }
};

const BAND_LABEL: Record<ReturnType<typeof getTrustBand>, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unknown: 'Unrated'
};

export default function RetailersPage() {
  const retailers = getAllRetailerTrust().slice().sort((a, b) => {
    // Sort highest trust first, unrated last
    const aScore = a.trustScore ?? -1;
    const bScore = b.trustScore ?? -1;
    return bScore - aScore;
  });

  const avgScore = (() => {
    const scored = retailers.filter(r => r.trustScore != null);
    if (!scored.length) return null;
    const sum = scored.reduce((acc, r) => acc + (r.trustScore ?? 0), 0);
    return sum / scored.length;
  })();

  const totalReviews = retailers.reduce((acc, r) => acc + (r.reviewCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#0f2419]">
      <header className="border-b border-[#c9a84c]/10 bg-[#1a3a2a]/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="text-3xl">🚬</div>
              <div>
                <h1 className="text-xl font-serif text-[#c9a84c] leading-tight">
                  Hearth &amp; Leaf
                </h1>
                <p className="text-xs text-[#8aaa7a]">CigarScanner</p>
              </div>
            </Link>
            <Link
              href="/"
              className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors"
            >
              ← Back to catalog
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif text-[#c9a84c] mb-3">
            UK Cigar Retailers
          </h2>
          <p className="text-[#8aaa7a] max-w-2xl">
            CigarScanner compares prices across every major UK cigar retailer. Here&apos;s the Trustpilot
            track record for each one so you can shop with confidence. All scores are sourced directly
            from Trustpilot and reverified periodically.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-[#1a3a2a]/60 rounded-xl p-5 border border-[#c9a84c]/10">
            <div className="text-[#8aaa7a] text-xs uppercase tracking-wide">Retailers tracked</div>
            <div className="text-3xl text-[#c9a84c] font-bold mt-1">{retailers.length}</div>
          </div>
          <div className="bg-[#1a3a2a]/60 rounded-xl p-5 border border-[#c9a84c]/10">
            <div className="text-[#8aaa7a] text-xs uppercase tracking-wide">Average TrustScore</div>
            <div className="text-3xl text-[#c9a84c] font-bold mt-1">
              {avgScore != null ? avgScore.toFixed(2) : '—'}
              <span className="text-base text-[#8aaa7a] font-normal"> / 5</span>
            </div>
          </div>
          <div className="bg-[#1a3a2a]/60 rounded-xl p-5 border border-[#c9a84c]/10">
            <div className="text-[#8aaa7a] text-xs uppercase tracking-wide">Verified reviews</div>
            <div className="text-3xl text-[#c9a84c] font-bold mt-1">
              {totalReviews.toLocaleString()}+
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {retailers.map(r => {
            const band = getTrustBand(r.trustScore);
            return (
              <div
                key={r.retailer}
                className="bg-[#1a3a2a]/60 rounded-2xl p-5 sm:p-6 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl text-white font-semibold">{r.retailer}</h3>
                      {r.established && (
                        <span className="text-[10px] uppercase tracking-wide text-[#8aaa7a] border border-[#c9a84c]/20 rounded px-1.5 py-0.5">
                          Est. {r.established}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border ${
                          band === 'excellent'
                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                            : band === 'good'
                              ? 'text-lime-300 border-lime-500/30 bg-lime-500/10'
                              : band === 'fair'
                                ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                                : band === 'poor'
                                  ? 'text-red-300 border-red-500/30 bg-red-500/10'
                                  : 'text-[#8aaa7a] border-[#c9a84c]/20 bg-[#0f2419]/60'
                        }`}
                      >
                        {BAND_LABEL[band]}
                      </span>
                    </div>
                    <p className="text-[#8aaa7a] text-sm mt-2">{r.blurb}</p>
                    <p className="text-[#8aaa7a]/60 text-[11px] mt-3">
                      Trustpilot data last verified {r.lastVerified}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <TrustBadge retailer={r.retailer} variant="full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 bg-[#1a3a2a]/40 rounded-xl p-5 border border-[#c9a84c]/10">
          <h3 className="text-[#c9a84c] font-semibold mb-2">About these scores</h3>
          <p className="text-[#8aaa7a] text-sm">
            Trustpilot is an independent review platform. CigarScanner does not influence reviews or
            scores and is not paid by any retailer to feature them. Some retailer links include an
            affiliate tag so we can keep the service free. The Trustpilot data shown here is a static
            snapshot and may drift between updates - always click through to see the live profile.
          </p>
        </div>
      </main>
    </div>
  );
}
