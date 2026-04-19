'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RefreshStatus {
  retailer: string;
  lastRun?: string;
  status: 'success' | 'error' | 'never';
  productsScraped: number;
  pricesUpdated: number;
  pricesAdded: number;
  newProducts: number;
  errors: string[];
  duration: number;
}

interface PriceChangeStats {
  last7Days: {
    totalChanges: number;
    increases: number;
    decreases: number;
    biggestIncrease: number;
    biggestDecrease: number;
  };
}

export default function RefreshDashboard() {
  const [refreshStats, setRefreshStats] = useState<RefreshStatus[]>([]);
  const [priceChangeStats, setPriceChangeStats] = useState<PriceChangeStats | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefreshStatus();
    fetchPriceChangeStats();
  }, []);

  const fetchRefreshStatus = async () => {
    try {
      const response = await fetch('/api/refresh-status');
      const data = await response.json();
      
      setRefreshStats(data.retailers || []);
      setLastRefreshTime(data.lastRefresh || '');
    } catch (error) {
      console.error('Error fetching refresh status:', error);
    }
  };

  const fetchPriceChangeStats = async () => {
    try {
      const response = await fetch('/api/price-changes?summary=true&days=7');
      const data = await response.json();
      
      setPriceChangeStats({
        last7Days: {
          totalChanges: data.totalChanges || 0,
          increases: data.increases || 0,
          decreases: data.decreases || 0,
          biggestIncrease: data.biggestIncrease || 0,
          biggestDecrease: data.biggestDecrease || 0,
        }
      });
    } catch (error) {
      console.error('Error fetching price change stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFreshnessColor = () => {
    if (!lastRefreshTime) return 'bg-red-500';
    
    const lastRefresh = new Date(lastRefreshTime);
    const now = new Date();
    const hoursAgo = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) return 'bg-green-500';
    if (hoursAgo < 48) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getFreshnessText = () => {
    if (!lastRefreshTime) return 'Never';
    
    const lastRefresh = new Date(lastRefreshTime);
    const now = new Date();
    const hoursAgo = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 1) return 'Just now';
    if (hoursAgo < 24) return `${Math.floor(hoursAgo)} hours ago`;
    if (hoursAgo < 48) return '1 day ago';
    return `${Math.floor(hoursAgo / 24)} days ago`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-[#0a1a10] text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="text-2xl font-bold font-[var(--font-playfair)] text-[#c9a84c] hover:text-white transition-colors"
              >
                Hearth & Leaf
              </Link>
              <span className="text-sm text-[#8aaa7a]">Data Health</span>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/admin/stale"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors"
              >
                Stale Detection
              </Link>
              <Link
                href="/"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors"
              >
                ← Back to Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-[var(--font-playfair)] text-white">
            Data Health Dashboard
          </h1>
        </div>

        {/* Last Refresh Status */}
        <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 mb-8 border border-[#c9a84c]/10">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getFreshnessColor()}`}></div>
            <div>
              <h2 className="text-lg font-semibold text-white font-[var(--font-playfair)]">
                Last Data Refresh
              </h2>
              <p className="text-[#8aaa7a]">{getFreshnessText()}</p>
              {lastRefreshTime && (
                <p className="text-[#c9a84c]/60 text-sm">
                  {new Date(lastRefreshTime).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price Changes Summary */}
        {priceChangeStats && (
          <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 mb-8 border border-[#c9a84c]/10">
            <h2 className="text-lg font-semibold text-white font-[var(--font-playfair)] mb-4">
              Last 7 Days Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#c9a84c]">
                  {priceChangeStats.last7Days.totalChanges}
                </p>
                <p className="text-sm text-[#8aaa7a]">Total Changes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  {priceChangeStats.last7Days.decreases}
                </p>
                <p className="text-sm text-[#8aaa7a]">Price Drops</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">
                  {priceChangeStats.last7Days.increases}
                </p>
                <p className="text-sm text-[#8aaa7a]">Price Increases</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  -£{Math.abs(priceChangeStats.last7Days.biggestDecrease).toFixed(2)}
                </p>
                <p className="text-sm text-[#8aaa7a]">Biggest Drop</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">
                  +£{priceChangeStats.last7Days.biggestIncrease.toFixed(2)}
                </p>
                <p className="text-sm text-[#8aaa7a]">Biggest Increase</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/price-changes"
                className="text-[#c9a84c] hover:underline text-sm"
              >
                View detailed price changes →
              </Link>
            </div>
          </div>
        )}

        {/* Retailer Status Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white font-[var(--font-playfair)] mb-4">
            Retailer Status
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 border border-[#c9a84c]/10 animate-pulse">
                  <div className="h-4 bg-[#c9a84c]/20 rounded mb-2"></div>
                  <div className="h-8 bg-[#c9a84c]/10 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {refreshStats.map((retailer) => (
                <div
                  key={retailer.retailer}
                  className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 border border-[#c9a84c]/10 hover:border-[#c9a84c]/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{retailer.retailer}</h3>
                    <div className={`w-3 h-3 rounded-full ${
                      retailer.status === 'success' 
                        ? 'bg-green-500' 
                        : retailer.status === 'error' 
                        ? 'bg-red-500' 
                        : 'bg-gray-500'
                    }`}></div>
                  </div>
                  
                  {retailer.lastRun ? (
                    <>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#8aaa7a]">Last run:</span>
                          <span className="text-[#c9a84c]">
                            {new Date(retailer.lastRun).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8aaa7a]">Products:</span>
                          <span className="text-white">{retailer.productsScraped}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8aaa7a]">Updated:</span>
                          <span className="text-blue-400">{retailer.pricesUpdated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8aaa7a]">Added:</span>
                          <span className="text-green-400">{retailer.pricesAdded}</span>
                        </div>
                        {retailer.newProducts > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#8aaa7a]">New products:</span>
                            <span className="text-[#c9a84c]">{retailer.newProducts}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#8aaa7a]">Duration:</span>
                          <span className="text-white">{formatDuration(retailer.duration)}</span>
                        </div>
                      </div>
                      
                      {retailer.errors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#c9a84c]/10">
                          <p className="text-red-400 text-sm font-medium mb-1">Errors:</p>
                          <div className="text-xs text-red-300 space-y-1 max-h-20 overflow-y-auto">
                            {retailer.errors.map((error, i) => (
                              <p key={i}>{error}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[#8aaa7a] text-sm">No data available</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}