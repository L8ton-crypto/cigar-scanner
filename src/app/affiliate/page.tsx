'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ClickStats {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
  clicksByRetailer: { retailer: string; clicks: number; percentage: number }[];
  topProducts: { 
    product_id: number; 
    product_name: string; 
    brand: string; 
    clicks: number; 
  }[];
  dailyClicks: { date: string; clicks: number }[];
}

export default function AffiliatePage() {
  const [stats, setStats] = useState<ClickStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching stats:', err);
        setError('Failed to load affiliate statistics');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f2419] flex items-center justify-center">
        <div className="text-[#c9a84c] text-xl">Loading affiliate stats...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-[#0f2419] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl text-white mb-4">Failed to load stats</h2>
          <p className="text-[#8aaa7a] mb-4">{error}</p>
          <Link href="/" className="text-[#c9a84c] hover:underline">← Back to Catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2419]">
      {/* Header */}
      <nav className="border-b border-[#c9a84c]/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#8aaa7a] hover:text-white transition-colors">← Back to Catalog</Link>
          <span className="text-[#c9a84c]/40">|</span>
          <span className="text-[#c9a84c] font-semibold">🚬 Hearth & Leaf</span>
          <span className="text-[#8aaa7a] text-sm">CigarScanner</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-white text-4xl font-bold mb-2">📊 Affiliate Statistics</h1>
          <p className="text-[#8aaa7a]">Track clicks and engagement with retailer links</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6">
            <h3 className="text-[#c9a84c] font-semibold mb-2">Total Clicks</h3>
            <p className="text-white text-3xl font-bold">{stats.totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6">
            <h3 className="text-[#c9a84c] font-semibold mb-2">Last 7 Days</h3>
            <p className="text-white text-3xl font-bold">{stats.clicksLast7Days.toLocaleString()}</p>
          </div>
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6">
            <h3 className="text-[#c9a84c] font-semibold mb-2">Last 30 Days</h3>
            <p className="text-white text-3xl font-bold">{stats.clicksLast30Days.toLocaleString()}</p>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clicks by Retailer */}
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6">
            <h2 className="text-[#c9a84c] text-xl font-bold mb-4">Clicks by Retailer</h2>
            {stats.clicksByRetailer.length === 0 ? (
              <p className="text-[#8aaa7a]">No click data available</p>
            ) : (
              <div className="space-y-3">
                {stats.clicksByRetailer.map((retailer, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-white font-medium">{retailer.retailer}</span>
                      {/* Visual bar */}
                      <div className="flex-1 bg-[#0f2419] rounded-full h-2">
                        <div 
                          className="bg-[#c9a84c] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(retailer.percentage, 5)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <span className="text-[#c9a84c] font-bold">{retailer.clicks}</span>
                      <span className="text-[#8aaa7a] text-sm ml-2">({retailer.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6">
            <h2 className="text-[#c9a84c] text-xl font-bold mb-4">Most Clicked Products</h2>
            {stats.topProducts.length === 0 ? (
              <p className="text-[#8aaa7a]">No product clicks available</p>
            ) : (
              <div className="space-y-3">
                {stats.topProducts.map((product, i) => (
                  <div key={product.product_id} className="flex items-center justify-between border-b border-[#c9a84c]/10 pb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#c9a84c] text-sm font-medium">#{i + 1}</span>
                        <span className="text-[#8aaa7a] text-sm">{product.brand}</span>
                      </div>
                      <Link href={`/cigar/${product.product_id}`} className="text-white hover:text-[#c9a84c] transition-colors text-sm line-clamp-2">
                        {product.product_name}
                      </Link>
                    </div>
                    <div className="text-[#c9a84c] font-bold ml-3">
                      {product.clicks}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Clicks Table */}
        <div className="bg-[#1a3a2a]/60 rounded-xl p-6 mt-8">
          <h2 className="text-[#c9a84c] text-xl font-bold mb-4">Daily Clicks (Last 30 Days)</h2>
          {stats.dailyClicks.length === 0 ? (
            <p className="text-[#8aaa7a]">No daily click data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c9a84c]/20">
                    <th className="text-left text-[#c9a84c] font-semibold py-2">Date</th>
                    <th className="text-right text-[#c9a84c] font-semibold py-2">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dailyClicks.map((day, i) => (
                    <tr key={day.date} className="border-b border-[#c9a84c]/10">
                      <td className="py-2 text-white">{new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td className="py-2 text-right text-[#c9a84c] font-medium">{day.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Disclosure Notice */}
        <div className="bg-[#1a3a2a]/60 rounded-xl p-6 mt-8">
          <h2 className="text-[#c9a84c] text-xl font-bold mb-4">📋 Affiliate Program Info</h2>
          <p className="text-[#8aaa7a] leading-relaxed">
            CigarScanner tracks clicks to retailer links and appends UTM parameters for analytics. 
            All outbound links include tracking for performance measurement. When formal affiliate 
            partnerships are established, commission rates and referral codes will be configured 
            per retailer in the system.
          </p>
        </div>
      </main>
    </div>
  );
}