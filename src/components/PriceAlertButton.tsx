'use client';

import { useState } from 'react';

interface PriceAlertButtonProps {
  productId: number;
  productName: string;
  currentPrice: number;
}

export function PriceAlertButton({ productId, productName, currentPrice }: PriceAlertButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    // Pre-fill with 10% below current price
    const suggested = (currentPrice * 0.9).toFixed(2);
    setTargetPrice(suggested);
    setEmail('');
    setSuccess(false);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          email,
          target_price: parseFloat(targetPrice)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create alert');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 bg-[#1a3a2a] hover:bg-[#234d36] 
                   text-[#c9a84c] border border-[#c9a84c]/30 hover:border-[#c9a84c]/60
                   font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
      >
        <span>🔔</span>
        Set Price Alert
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a3a2a] border border-[#c9a84c]/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            {success ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-white text-xl font-bold mb-2">Alert Set!</h3>
                <p className="text-[#8aaa7a] mb-2">
                  We&apos;ll notify you when <span className="text-white">{productName}</span> drops below <span className="text-[#c9a84c] font-bold">£{parseFloat(targetPrice).toFixed(2)}</span>
                </p>
                <p className="text-[#8aaa7a] text-sm mb-6">
                  Check your alerts anytime at the Alerts page.
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white text-xl font-bold flex items-center gap-2">
                    <span>🔔</span> Price Alert
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-[#8aaa7a] hover:text-white text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <p className="text-[#8aaa7a] mb-4 text-sm">
                  Get notified when <span className="text-white font-medium">{productName}</span> drops below your target price.
                </p>

                <div className="bg-[#0f2419]/60 rounded-xl p-3 mb-6 flex items-center justify-between">
                  <span className="text-[#8aaa7a] text-sm">Current best price</span>
                  <span className="text-[#c9a84c] font-bold text-lg">£{currentPrice.toFixed(2)}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[#8aaa7a] text-sm mb-1.5">Email address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-4 py-2.5 
                                 text-white placeholder-[#8aaa7a]/50 focus:border-[#c9a84c]/60 
                                 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8aaa7a] text-sm mb-1.5">Alert me when price drops below</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c9a84c] font-medium">£</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0.01"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        className="w-full bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg pl-8 pr-4 py-2.5 
                                   text-white focus:border-[#c9a84c]/60 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#c9a84c] hover:bg-[#b8974a] disabled:opacity-50 
                               text-[#0f2419] font-semibold py-3 rounded-lg transition-colors"
                  >
                    {loading ? 'Setting alert...' : 'Set Alert'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
