'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Deal {
  id: number;
  name: string;
  brand: string;
  min_price: number;
  max_price: number;
  image_url?: string;
  strength?: string;
  format?: string;
  retailer_count: number;
  savings: number;
  savings_pct: number;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchDeals();
  }, [page]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '24');

      const response = await fetch(`/api/deals?${params}`);
      const data = await response.json();

      setDeals(data.deals);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStrengthColor = (strength?: string) => {
    if (!strength) return 'bg-gray-500';
    switch (strength.toLowerCase()) {
      case 'mild': return 'bg-green-500';
      case 'medium': return 'bg-[#c9a84c]';
      case 'full': case 'strong': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSavingsBadgeColor = (pct: number) => {
    if (pct >= 50) return 'bg-green-500 text-white';
    if (pct >= 30) return 'bg-green-600 text-white';
    if (pct >= 15) return 'bg-[#c9a84c] text-[#0f2419]';
    return 'bg-[#c9a84c]/60 text-[#0f2419]';
  };

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.jpg"
                  alt="Hearth & Leaf"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-2xl font-bold font-[var(--font-playfair)] text-[#c9a84c]">
                    Hearth & Leaf
                  </h1>
                  <p className="text-sm text-[#8aaa7a]">CigarScanner</p>
                </div>
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors"
              >
                Browse All
              </Link>
              <Link
                href="/alerts"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors flex items-center gap-1.5"
              >
                <span>🔔</span> Alerts
              </Link>
              <Link
                href="/history"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors flex items-center gap-1.5"
              >
                <span>🕒</span> History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold font-[var(--font-playfair)] text-white mb-3">
            Best <span className="text-[#c9a84c]">Deals</span>
          </h1>
          <p className="text-lg text-[#8aaa7a] max-w-2xl mx-auto">
            Cigars with the biggest price differences across UK retailers. Same cigar, different price - shop smart.
          </p>
          {!loading && (
            <p className="text-sm text-[#8aaa7a] mt-3">
              {total.toLocaleString()} cigars with savings across multiple retailers
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 animate-pulse">
                <div className="aspect-[3/4] bg-[#0a1a10] rounded-lg mb-4"></div>
                <div className="h-4 bg-[#0a1a10] rounded mb-2 w-1/3"></div>
                <div className="h-6 bg-[#0a1a10] rounded mb-3"></div>
                <div className="h-8 w-24 bg-[#0a1a10] rounded mb-4"></div>
                <div className="h-10 bg-[#0a1a10] rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Deals Grid */}
        {!loading && deals.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💰</div>
            <h3 className="text-2xl font-semibold text-white mb-2">No deals found</h3>
            <p className="text-[#8aaa7a]">Check back soon - deals update as we track more retailers.</p>
          </div>
        )}

        {!loading && deals.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {deals.map((deal, index) => {
                const savings = Number(deal.savings);
                const savingsPct = Number(deal.savings_pct);
                const minPrice = Number(deal.min_price);
                const maxPrice = Number(deal.max_price);

                return (
                  <div
                    key={deal.id}
                    className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all relative"
                  >
                    {/* Rank badge for top 3 */}
                    {page === 1 && index < 3 && (
                      <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-[#c9a84c] text-[#0f2419] font-bold flex items-center justify-center text-sm z-10 shadow-lg">
                        {index + 1}
                      </div>
                    )}

                    {/* Savings badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getSavingsBadgeColor(savingsPct)}`}>
                        Save {savingsPct}%
                      </span>
                    </div>

                    {/* Image */}
                    <div className="relative aspect-[3/4] mb-4 rounded-lg overflow-hidden bg-[#0a1a10]">
                      {deal.image_url ? (
                        <Image
                          src={deal.image_url}
                          alt={deal.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-[#c9a84c]/30 text-6xl">🚬</div>
                        </div>
                      )}
                    </div>

                    {/* Brand */}
                    <p className="text-[#c9a84c] text-sm font-medium mb-1">{deal.brand}</p>

                    {/* Name */}
                    <h3 className="text-white font-semibold text-lg leading-tight mb-3 line-clamp-2">
                      {deal.name}
                    </h3>

                    {/* Strength & Format */}
                    <div className="flex gap-2 mb-4">
                      {deal.strength && (
                        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStrengthColor(deal.strength)}`}>
                          {deal.strength}
                        </span>
                      )}
                      {deal.format && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-[#0f2419] text-[#8aaa7a] border border-[#c9a84c]/20">
                          {deal.format}
                        </span>
                      )}
                    </div>

                    {/* Price comparison */}
                    <div className="bg-[#0f2419] rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-[#8aaa7a] text-xs block">Best price</span>
                          <span className="text-green-400 text-xl font-bold">£{minPrice.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#8aaa7a] text-xs block">Highest</span>
                          <span className="text-red-400/70 text-lg line-through">£{maxPrice.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#c9a84c]/10">
                        <span className="text-green-400 font-semibold text-sm">
                          You save £{savings.toFixed(2)}
                        </span>
                        <span className="text-[#8aaa7a] text-xs">
                          {deal.retailer_count} retailers
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <Link
                      href={`/cigar/${deal.id}`}
                      className="block w-full bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] text-center py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Compare Prices
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-12">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-[#c9a84c]/20 text-white hover:bg-[#1a3a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-[#8aaa7a] text-sm px-4">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg border border-[#c9a84c]/20 text-white hover:bg-[#1a3a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
