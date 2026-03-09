'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getScanHistory, deleteScan, clearHistory, type ScanRecord } from '@/lib/scanHistory';

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setScans(getScanHistory());
  }, []);

  const handleDelete = (id: string) => {
    deleteScan(id);
    setScans(getScanHistory());
  };

  const handleClearAll = () => {
    clearHistory();
    setScans([]);
    setShowClearConfirm(false);
  };

  const filtered = scans.filter(scan => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      scan.identification.brand?.toLowerCase().includes(q) ||
      scan.identification.name?.toLowerCase().includes(q) ||
      scan.identification.format?.toLowerCase().includes(q) ||
      scan.identification.country?.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return { text: 'High', color: 'text-green-400' };
    if (confidence >= 0.7) return { text: 'Good', color: 'text-[#c9a84c]' };
    if (confidence >= 0.5) return { text: 'Fair', color: 'text-yellow-400' };
    return { text: 'Low', color: 'text-red-400' };
  };

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.jpg"
                  alt="Hearth & Leaf"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-xl font-bold font-[var(--font-playfair)] text-[#c9a84c]">
                    Hearth & Leaf
                  </h1>
                  <p className="text-xs text-[#8aaa7a]">CigarScanner</p>
                </div>
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors"
              >
                Browse
              </Link>
              <span className="text-[#c9a84c] text-sm font-medium">
                History
              </span>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold font-[var(--font-playfair)] text-white">
              Scan History
            </h2>
            <p className="text-[#8aaa7a] mt-1">
              {scans.length === 0
                ? 'No scans yet - scan your first cigar!'
                : `${scans.length} scan${scans.length === 1 ? '' : 's'} saved locally`}
            </p>
          </div>
          {scans.length > 0 && (
            <div className="flex gap-2">
              {showClearConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400">Clear all?</span>
                  <button
                    onClick={handleClearAll}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-[#8aaa7a] px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        {scans.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search your scans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1a3a2a]/80 border border-[#c9a84c]/20 rounded-lg px-4 py-3 text-white placeholder-[#8aaa7a] focus:border-[#c9a84c] focus:outline-none transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8aaa7a]">🔍</span>
            </div>
          </div>
        )}

        {/* Scan List */}
        {scans.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-7xl mb-6">📷</div>
            <h3 className="text-2xl font-semibold text-white mb-3">No scans yet</h3>
            <p className="text-[#8aaa7a] mb-6 max-w-md mx-auto">
              Scan a cigar to identify it and find the best prices. Your scan history will appear here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <span>📷</span> Scan Your First Cigar
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">No matching scans</h3>
            <p className="text-[#8aaa7a]">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((scan) => {
              const conf = getConfidenceLabel(scan.identification.confidence);
              const cigarName = scan.identification.name || 'Unknown cigar';
              const brand = scan.identification.brand || 'Unknown brand';

              return (
                <div
                  key={scan.id}
                  className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all group"
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-[#0a1a10] flex-shrink-0">
                      {scan.thumbnail ? (
                        <Image
                          src={scan.thumbnail}
                          alt={cigarName}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-[#c9a84c]/30">
                          🚬
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[#c9a84c] text-sm font-medium">{brand}</p>
                          <h3 className="text-white font-semibold truncate">{cigarName}</h3>
                        </div>
                        <span className="text-[#8aaa7a] text-xs whitespace-nowrap flex-shrink-0">
                          {formatDate(scan.timestamp)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {scan.identification.format && (
                          <span className="bg-[#0f2419] text-[#8aaa7a] px-2 py-0.5 rounded text-xs">
                            {scan.identification.format}
                          </span>
                        )}
                        {scan.identification.country && (
                          <span className="bg-[#0f2419] text-[#8aaa7a] px-2 py-0.5 rounded text-xs">
                            {scan.identification.country}
                          </span>
                        )}
                        <span className={`text-xs ${conf.color}`}>
                          {conf.text} confidence
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-sm">
                          {scan.bestPrice !== undefined && (
                            <span className="text-[#c9a84c] font-medium">
                              From £{scan.bestPrice.toFixed(2)}
                            </span>
                          )}
                          {scan.matchCount > 0 ? (
                            <span className="text-[#8aaa7a]">
                              {scan.matchCount} match{scan.matchCount === 1 ? '' : 'es'}
                              {scan.retailerCount ? ` · ${scan.retailerCount} retailer${scan.retailerCount === 1 ? '' : 's'}` : ''}
                            </span>
                          ) : (
                            <span className="text-[#8aaa7a]">No UK matches</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(scan.id)}
                          className="text-[#8aaa7a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm px-2 py-1 rounded"
                          title="Delete scan"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
