'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface PriceChange {
  id: number;
  product_id: number;
  retailer: string;
  old_price: string;
  new_price: string;
  changed_at: string;
  product_name: string;
  brand: string;
  image_url: string | null;
  min_price: string;
  percent_change: string;
}

interface Stats {
  drops: string;
  increases: string;
  total: string;
  avg_drop: string | null;
  avg_increase: string | null;
}

export default function PriceChangesPage() {
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'drops' | 'increases'>('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/price-changes?days=7&limit=100&type=${filter}`)
      .then(r => r.json())
      .then(data => {
        setChanges(data.changes || []);
        setStats(data.stats || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  const filteredChanges = filter === 'all' 
    ? changes 
    : filter === 'drops'
    ? changes.filter(c => parseFloat(c.new_price) < parseFloat(c.old_price))
    : changes.filter(c => parseFloat(c.new_price) > parseFloat(c.old_price));

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image src="/logo.jpg" alt="Hearth & Leaf" width={40} height={40} className="rounded-lg" />
                <div>
                  <h1 className="text-xl font-bold font-[var(--font-playfair)] text-[#c9a84c]">
                    Price Changes
                  </h1>
                  <p className="text-xs text-[#8aaa7a]">Last 7 days</p>
                </div>
              </Link>
            </div>
            <Link href="/" className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors">
              ← Back
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1a3a2a]/80 rounded-xl p-4 border border-[#c9a84c]/10">
              <p className="text-2xl font-bold text-white">{parseInt(stats.total).toLocaleString()}</p>
              <p className="text-xs text-[#8aaa7a]">Total Changes</p>
            </div>
            <div className="bg-[#1a3a2a]/80 rounded-xl p-4 border border-green-500/20">
              <p className="text-2xl font-bold text-green-400">📉 {parseInt(stats.drops).toLocaleString()}</p>
              <p className="text-xs text-[#8aaa7a]">
                Price Drops
                {stats.avg_drop && <span className="ml-1">(avg £{Math.abs(parseFloat(stats.avg_drop)).toFixed(2)})</span>}
              </p>
            </div>
            <div className="bg-[#1a3a2a]/80 rounded-xl p-4 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">📈 {parseInt(stats.increases).toLocaleString()}</p>
              <p className="text-xs text-[#8aaa7a]">
                Price Increases
                {stats.avg_increase && <span className="ml-1">(avg £{parseFloat(stats.avg_increase).toFixed(2)})</span>}
              </p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'drops', 'increases'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[#c9a84c] text-[#0f2419]'
                  : 'bg-[#1a3a2a]/80 text-[#8aaa7a] hover:text-white border border-[#c9a84c]/10'
              }`}
            >
              {f === 'all' ? 'All Changes' : f === 'drops' ? '📉 Drops Only' : '📈 Increases Only'}
            </button>
          ))}
        </div>

        {/* Changes List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner w-10 h-10" />
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="text-center py-20 text-[#8aaa7a]">
            <p className="text-lg mb-2">No price changes found</p>
            <p className="text-sm">Check back after the next price refresh</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChanges.map(change => {
              const oldP = parseFloat(change.old_price);
              const newP = parseFloat(change.new_price);
              const isDrop = newP < oldP;
              const diff = Math.abs(newP - oldP);
              const pct = parseFloat(change.percent_change);

              return (
                <Link
                  key={change.id}
                  href={`/cigar/${change.product_id}`}
                  className="block bg-[#1a3a2a]/80 rounded-xl p-4 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Image */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0a1a10] flex-shrink-0">
                      {change.image_url ? (
                        <Image
                          src={change.image_url}
                          alt={change.product_name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#c9a84c]/30 text-xl">
                          🚬
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{change.product_name}</p>
                      <p className="text-xs text-[#8aaa7a]">
                        {change.brand && <span>{change.brand} · </span>}
                        {change.retailer} · {new Date(change.changed_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>

                    {/* Price Change */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#8aaa7a] line-through text-sm">£{oldP.toFixed(2)}</span>
                        <span className="text-lg">→</span>
                        <span className={`font-bold ${isDrop ? 'text-green-400' : 'text-red-400'}`}>
                          £{newP.toFixed(2)}
                        </span>
                      </div>
                      <p className={`text-xs font-medium ${isDrop ? 'text-green-400' : 'text-red-400'}`}>
                        {isDrop ? '↓' : '↑'} £{diff.toFixed(2)} ({Math.abs(pct).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
