'use client';

import { getRetailerTrust, getTrustBand, type TrustBand } from '@/lib/retailer-trust';

interface TrustBadgeProps {
  retailer: string;
  /** compact = just score and stars; full = score + review count + link */
  variant?: 'compact' | 'full';
}

const BAND_COLOURS: Record<TrustBand, { text: string; bg: string; border: string }> = {
  excellent: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  good: { text: 'text-lime-300', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
  fair: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  poor: { text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  unknown: { text: 'text-[#8aaa7a]', bg: 'bg-[#0f2419]/60', border: 'border-[#c9a84c]/20' }
};

function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return count.toString();
}

function Stars({ score }: { score: number }) {
  // Render 5 slots; fill proportionally based on score (score/5 * 5 = score).
  const filled = Math.round(score);
  return (
    <span aria-hidden="true" className="inline-flex leading-none">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= filled ? 'text-emerald-400' : 'text-[#8aaa7a]/30'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function TrustBadge({ retailer, variant = 'compact' }: TrustBadgeProps) {
  const trust = getRetailerTrust(retailer);
  if (!trust) return null;

  const band = getTrustBand(trust.trustScore);
  const colours = BAND_COLOURS[band];

  if (trust.trustScore == null || trust.reviewCount == null) {
    // No score yet - show neutral "verified retailer" pill that still links to Trustpilot
    return (
      <a
        href={trust.trustpilotUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${colours.bg} ${colours.border} ${colours.text} hover:brightness-125`}
        aria-label={`See Trustpilot reviews for ${retailer} (opens in new tab)`}
        title={`See Trustpilot reviews for ${retailer}`}
      >
        <span>Trustpilot</span>
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={trust.trustpilotUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${colours.bg} ${colours.border} ${colours.text} hover:brightness-125`}
        aria-label={`Trustpilot score ${trust.trustScore} out of 5 from ${trust.reviewCount} reviews. See reviews on Trustpilot (opens in new tab).`}
        title={`Trustpilot: ${trust.trustScore}/5 from ${trust.reviewCount.toLocaleString()} reviews`}
      >
        <span className="font-bold">{trust.trustScore.toFixed(1)}</span>
        <span aria-hidden="true">★</span>
        <span className="opacity-70">({formatReviewCount(trust.reviewCount)})</span>
      </a>
    );
  }

  return (
    <a
      href={trust.trustpilotUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-md border ${colours.bg} ${colours.border} ${colours.text} hover:brightness-125`}
      aria-label={`Trustpilot score ${trust.trustScore} out of 5 from ${trust.reviewCount.toLocaleString()} reviews. See reviews on Trustpilot (opens in new tab).`}
      title={`Trustpilot: ${trust.trustScore}/5 from ${trust.reviewCount.toLocaleString()} reviews`}
    >
      <Stars score={trust.trustScore} />
      <span className="font-bold">{trust.trustScore.toFixed(1)}</span>
      <span className="opacity-80">/ 5</span>
      <span className="opacity-70">({trust.reviewCount.toLocaleString()} reviews)</span>
      <span className="opacity-60 text-[10px] uppercase tracking-wide">Trustpilot ↗</span>
    </a>
  );
}

export default TrustBadge;
