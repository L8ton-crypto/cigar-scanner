'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Alert {
  id: number;
  product_id: number;
  email: string;
  target_price: number;
  active: boolean;
  created_at: string;
  triggered_at: string | null;
  product_name: string;
  product_brand: string;
  current_price: number;
  product_image: string | null;
}

interface AlertsResponse {
  alerts: Alert[];
}

export default function AlertsPage() {
  const [email, setEmail] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Check localStorage for saved email
    const savedEmail = localStorage.getItem('cigarscanner-alert-email');
    if (savedEmail) {
      setEmail(savedEmail);
      fetchAlerts(savedEmail);
    }
  }, []);

  const fetchAlerts = async (userEmail: string) => {
    if (!userEmail.trim()) return;

    setLoading(true);
    setHasSearched(true);
    
    try {
      const response = await fetch(`/api/alerts?email=${encodeURIComponent(userEmail)}`);
      if (response.ok) {
        const data: AlertsResponse = await response.json();
        setAlerts(data.alerts);
        
        // Save email to localStorage
        localStorage.setItem('cigarscanner-alert-email', userEmail);
      } else {
        console.error('Failed to fetch alerts');
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        // Remove the alert from the local state
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      } else {
        console.error('Failed to delete alert');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAlerts(email);
  };

  const activeAlerts = alerts.filter(alert => alert.active);
  const triggeredAlerts = alerts.filter(alert => !alert.active);

  return (
    <div className="min-h-screen bg-[#0f2419]">
      {/* Navigation Header */}
      <nav className="border-b border-[#c9a84c]/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#8aaa7a] hover:text-white transition-colors">← Back to Catalog</Link>
          <span className="text-[#c9a84c]/40">|</span>
          <span className="text-[#c9a84c] font-semibold">🚬 Hearth & Leaf</span>
          <span className="text-[#8aaa7a] text-sm">Price Alerts</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-[var(--font-playfair)] text-[#c9a84c] mb-2">
            Your Price Alerts
          </h1>
          <p className="text-[#8aaa7a]">
            Manage your cigar price alerts and never miss a great deal
          </p>
        </div>

        {/* Email Input Form */}
        <div className="max-w-md mx-auto mb-8">
          <form onSubmit={handleSubmit} className="bg-[#1a3a2a]/60 border border-[#c9a84c]/10 rounded-lg p-6">
            <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
              Email Address
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0f2419] border border-[#c9a84c]/20 rounded text-white placeholder-[#8aaa7a] focus:outline-none focus:border-[#c9a84c]/50"
                placeholder="Enter your email address"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#c9a84c] text-[#0f2419] font-medium rounded hover:bg-[#c9a84c]/90 disabled:opacity-50 transition-colors"
              >
                {loading ? '...' : 'Check Alerts'}
              </button>
            </div>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#c9a84c]"></div>
            <p className="text-[#8aaa7a] mt-4">Loading your alerts...</p>
          </div>
        )}

        {/* No Email State */}
        {!hasSearched && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📧</div>
            <h3 className="text-xl text-white mb-2">Enter your email to view your price alerts</h3>
            <p className="text-[#8aaa7a]">
              We'll show you all the price alerts you've set up for your favorite cigars.
            </p>
          </div>
        )}

        {/* No Alerts Found */}
        {hasSearched && !loading && alerts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-xl text-white mb-2">No alerts found for this email</h3>
            <p className="text-[#8aaa7a] mb-4">
              Set alerts from any cigar's detail page.
            </p>
            <Link 
              href="/"
              className="inline-block px-4 py-2 bg-[#c9a84c] text-[#0f2419] font-medium rounded hover:bg-[#c9a84c]/90 transition-colors"
            >
              Browse Cigars
            </Link>
          </div>
        )}

        {/* Alerts Display */}
        {!loading && alerts.length > 0 && (
          <div className="space-y-8">
            {/* Summary */}
            <div className="text-center">
              <p className="text-[#d4ddd0]">
                <span className="text-[#c9a84c] font-medium">{activeAlerts.length}</span> active alerts
                {triggeredAlerts.length > 0 && (
                  <>
                    {' • '}
                    <span className="text-[#8aaa7a]">{triggeredAlerts.length} triggered</span>
                  </>
                )}
              </p>
            </div>

            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
              <div>
                <h2 className="text-2xl font-[var(--font-playfair)] text-white mb-4 flex items-center gap-2">
                  🔔 Active Alerts
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onDelete={deleteAlert} />
                  ))}
                </div>
              </div>
            )}

            {/* Triggered Alerts */}
            {triggeredAlerts.length > 0 && (
              <div>
                <h2 className="text-2xl font-[var(--font-playfair)] text-white mb-4 flex items-center gap-2">
                  ✅ Triggered Alerts
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {triggeredAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} onDelete={deleteAlert} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AlertCardProps {
  alert: Alert;
  onDelete: (id: number) => void;
}

function AlertCard({ alert, onDelete }: AlertCardProps) {
  const formatPrice = (price: number) => `£${price.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');
  
  const isPriceReached = alert.current_price <= alert.target_price;

  return (
    <div className="bg-[#1a3a2a]/60 border border-[#c9a84c]/10 rounded-lg p-4 relative">
      {/* Delete Button */}
      <button
        onClick={() => onDelete(alert.id)}
        className="absolute top-3 right-3 text-red-400 hover:text-red-300 text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-400/10 transition-colors"
        title="Delete alert"
      >
        ×
      </button>

      {/* Product Image */}
      <div className="mb-3">
        {alert.product_image ? (
          <Image
            src={alert.product_image}
            alt={`${alert.product_brand} ${alert.product_name}`}
            width={80}
            height={80}
            className="w-20 h-20 object-cover rounded border border-[#c9a84c]/20"
          />
        ) : (
          <div className="w-20 h-20 bg-[#0f2419] border border-[#c9a84c]/20 rounded flex items-center justify-center text-3xl">
            🚬
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="space-y-2">
        <Link 
          href={`/cigar/${alert.product_id}`}
          className="block text-white hover:text-[#c9a84c] transition-colors"
        >
          <h3 className="font-medium text-sm leading-tight">
            {alert.product_brand} {alert.product_name}
          </h3>
        </Link>

        {/* Prices */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[#8aaa7a] text-xs">Target Price:</span>
            <span className="text-[#c9a84c] font-medium text-sm">{formatPrice(alert.target_price)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8aaa7a] text-xs">Current Price:</span>
            <span className={`font-medium text-sm ${isPriceReached ? 'text-green-400' : 'text-white'}`}>
              {formatPrice(alert.current_price)}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="pt-2">
          {alert.active ? (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30">
              Triggered ✓ {alert.triggered_at && formatDate(alert.triggered_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}