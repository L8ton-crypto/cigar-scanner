'use client';

import { useState, useEffect } from 'react';

interface RefreshData {
  lastRefresh: string | null;
  stats: {
    totalProducts: number;
    totalPrices: number;
    verifiedLast7Days: number;
  };
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export function RefreshBadge() {
  const [data, setData] = useState<RefreshData | null>(null);

  useEffect(() => {
    fetch('/api/refresh-status')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || !data.lastRefresh) return null;

  const freshness = (() => {
    const diffMs = Date.now() - new Date(data.lastRefresh).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 1) return 'fresh';
    if (diffDays < 7) return 'recent';
    return 'stale';
  })();

  const dotColor = {
    fresh: 'bg-green-400',
    recent: 'bg-yellow-400',
    stale: 'bg-red-400'
  }[freshness];

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-[#8aaa7a]">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>Prices updated {timeAgo(data.lastRefresh)}</span>
    </div>
  );
}
