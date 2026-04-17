'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PriceAlertButton } from '@/components/PriceAlertButton';
import { FavouriteButton } from '@/components/FavouriteButton';
import { Sparkline } from '@/components/Sparkline';

interface Product {
  id: number;
  name: string;
  brand: string;
  description: string;
  image_url?: string;
  format?: string;
  strength?: string;
  country?: string;
  length_mm?: number;
  ring_gauge?: number;
  min_price: number;
  max_price: number;
  retailer_count: number;
  best_price_per_inch?: number | null;
}

interface Price {
  retailer: string;
  retailer_url: string;
  price: number;
  original_price?: number;
  currency: string;
  available: boolean;
  url: string;
  source_name: string;
  pack_count?: number;
  pack_kind?: string;
  price_per_inch?: number | null;
}

interface RelatedProduct {
  id: number;
  name: string;
  brand: string;
  image_url?: string;
  min_price: number;
  strength?: string;
  format?: string;
  retailer_count: number;
}

interface PriceHistoryData {
  retailer: string;
  data: { date: string; price: number }[];
}

export default function CigarDetailPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/cigars/${params.id}`)
        .then(res => res.json())
        .then(data => {
          setProduct(data.cigar);
          setPrices(data.prices || []);
          setRelated(data.related || []);
          setPriceHistory(data.priceHistory || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f2419] flex items-center justify-center">
        <div className="text-[#c9a84c] text-xl">Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0f2419] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚬</div>
          <h2 className="text-2xl text-white mb-4">Cigar not found</h2>
          <Link href="/" className="text-[#c9a84c] hover:underline">← Back to Catalog</Link>
        </div>
      </div>
    );
  }

  const cheapest = prices.length > 0 ? prices[0] : null;
  const savings = prices.length > 1 ? Number(prices[prices.length - 1].price) - Number(prices[0].price) : 0;

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
        {/* Product Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#1a3a2a]">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} fill className="object-contain p-4" sizes="(max-width: 1024px) 100vw, 50vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-[#c9a84c]/20 text-9xl">🚬</div>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-[#c9a84c] text-lg font-medium mb-2">{product.brand}</p>
            
            <div className="flex items-start gap-3 mb-6">
              <h1 className="text-white text-4xl font-bold flex-1">{product.name}</h1>
              <FavouriteButton cigar={{
                id: product.id,
                name: product.name,
                brand: product.brand,
                min_price: product.min_price,
                max_price: product.max_price,
                image_url: product.image_url,
                strength: product.strength,
                format: product.format,
                retailer_count: product.retailer_count,
              }} size="md" />
            </div>

            {/* Specs */}
            <div className="bg-[#1a3a2a]/60 rounded-xl p-6 mb-6">
              <h2 className="text-[#c9a84c] font-semibold mb-3">Specifications</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {product.format && <div><span className="text-[#8aaa7a]">Format:</span> <span className="text-white">{product.format}</span></div>}
                {product.strength && <div><span className="text-[#8aaa7a]">Strength:</span> <span className="text-white">{product.strength}</span></div>}
                {product.country && <div><span className="text-[#8aaa7a]">Origin:</span> <span className="text-white">{product.country}</span></div>}
                {product.length_mm && (
                  <div>
                    <span className="text-[#8aaa7a]">Length:</span>{' '}
                    <span className="text-white">
                      {product.length_mm}mm ({(product.length_mm / 25.4).toFixed(1)}&quot;)
                    </span>
                  </div>
                )}
                {product.ring_gauge && <div><span className="text-[#8aaa7a]">Ring Gauge:</span> <span className="text-white">{product.ring_gauge}</span></div>}
                {product.best_price_per_inch != null && (
                  <div className="col-span-2 pt-2 mt-1 border-t border-[#c9a84c]/10">
                    <span className="text-[#8aaa7a]">Best price per inch:</span>{' '}
                    <span className="text-[#c9a84c] font-semibold">
                      £{product.best_price_per_inch.toFixed(2)}
                    </span>
                    <span className="text-[#8aaa7a] text-xs ml-2">per stick</span>
                  </div>
                )}
              </div>
              {!product.length_mm && (
                <p className="text-[#8aaa7a] text-xs mt-3">
                  Dimensions unknown - price per inch requires length.
                </p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="bg-[#1a3a2a]/60 rounded-xl p-6 mb-6">
                <h2 className="text-[#c9a84c] font-semibold mb-3">Description</h2>
                <p className="text-[#d4ddd0] leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Price Comparison */}
        <div className="bg-[#1a3a2a]/60 rounded-2xl p-8 mb-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-[#c9a84c] text-2xl font-bold">
              💰 Price Comparison
            </h2>
            <div className="flex items-center gap-3">
              {savings > 0 && (
                <span className="bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                  Save up to £{savings.toFixed(2)} by comparing
                </span>
              )}
              {cheapest && (
                <PriceAlertButton
                  productId={product.id}
                  productName={`${product.brand} ${product.name}`}
                  currentPrice={Number(cheapest.price)}
                />
              )}
            </div>
          </div>

          {prices.length === 0 ? (
            <p className="text-[#8aaa7a]">No prices available</p>
          ) : (
            <div className="space-y-3">
              {prices.map((price, i) => {
                const isCheapest = i === 0 && prices.length > 1;
                return (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    isCheapest 
                      ? 'border-green-500/40 bg-green-500/5' 
                      : 'border-[#c9a84c]/10 bg-[#0f2419]/50 hover:bg-[#0f2419]'
                  }`}>
                    <div className="flex items-center gap-4">
                      {isCheapest && (
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                          BEST PRICE
                        </span>
                      )}
                      <div>
                        <p className="text-white font-medium">{price.retailer}</p>
                        <p className="text-[#8aaa7a] text-xs mt-0.5">{price.source_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {price.original_price && Number(price.original_price) > Number(price.price) && (
                          <span className="text-[#8aaa7a] line-through text-sm mr-2">
                            £{Number(price.original_price).toFixed(2)}
                          </span>
                        )}
                        <span className={`text-2xl font-bold ${isCheapest ? 'text-green-400' : 'text-[#c9a84c]'}`}>
                          £{Number(price.price).toFixed(2)}
                        </span>
                        {price.pack_count && price.pack_count > 1 && (
                          <p className="text-[#8aaa7a] text-xs mt-0.5">
                            £{(Number(price.price) / price.pack_count).toFixed(2)} / stick
                          </p>
                        )}
                        {price.price_per_inch != null && (
                          <p className="text-[#8aaa7a] text-xs">
                            £{price.price_per_inch.toFixed(2)} / inch
                          </p>
                        )}
                      </div>
                      <a
                        href={`/api/click?pid=${product.id}&retailer=${encodeURIComponent(price.retailer)}&url=${encodeURIComponent(price.url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                          isCheapest 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : 'bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419]'
                        }`}
                      >
                        Buy →
                        <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Price History */}
        <div className="bg-[#1a3a2a]/60 rounded-2xl p-8 mb-12">
          <h2 className="text-[#c9a84c] text-2xl font-bold mb-6">
            📈 Price History
          </h2>
          
          {priceHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-[#c9a84c]/30 text-4xl mb-3">📊</div>
              <p className="text-[#8aaa7a]">Price tracking started - check back soon</p>
            </div>
          ) : (
            <div className="space-y-4">
              {priceHistory.map((retailerHistory, i) => {
                const currentPrice = prices.find(p => p.retailer === retailerHistory.retailer);
                const firstPrice = retailerHistory.data[0]?.price;
                const lastPrice = retailerHistory.data[retailerHistory.data.length - 1]?.price;
                
                let trend = 'neutral';
                let trendPercent = 0;
                if (firstPrice && lastPrice && firstPrice !== lastPrice) {
                  trendPercent = ((lastPrice - firstPrice) / firstPrice) * 100;
                  trend = lastPrice < firstPrice ? 'down' : 'up';
                }
                
                return (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-4 rounded-xl border border-[#c9a84c]/10 bg-[#0f2419]/50 hover:bg-[#0f2419] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-white font-medium">{retailerHistory.retailer}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Sparkline 
                            data={retailerHistory.data}
                            width={100}
                            height={24}
                          />
                          {trend !== 'neutral' && (
                            <span className={`text-xs font-medium ${
                              trend === 'down' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {trend === 'down' ? '↓' : '↑'} {Math.abs(trendPercent).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {currentPrice && (
                        <span className="text-[#c9a84c] text-xl font-bold">
                          £{Number(currentPrice.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div>
            <h2 className="text-[#c9a84c] text-2xl font-bold mb-6">Related Cigars</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {related.map(r => (
                <Link key={r.id} href={`/cigar/${r.id}`} className="bg-[#1a3a2a]/60 rounded-xl p-3 hover:bg-[#1a3a2a] transition-colors">
                  <div className="relative aspect-[3/4] mb-2 rounded-lg overflow-hidden bg-[#0a1a10]">
                    {r.image_url ? (
                      <Image src={r.image_url} alt={r.name} fill className="object-cover" sizes="150px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-[#c9a84c]/20 text-3xl">🚬</div>
                      </div>
                    )}
                    {r.retailer_count > 1 && (
                      <div className="absolute top-1 right-1 bg-[#c9a84c] text-[#0f2419] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {r.retailer_count}
                      </div>
                    )}
                  </div>
                  <p className="text-[#c9a84c] text-xs">{r.brand}</p>
                  <p className="text-white text-sm font-medium line-clamp-2 mb-1">{r.name}</p>
                  <p className="text-[#c9a84c] font-bold">from £{Number(r.min_price).toFixed(2)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Affiliate Disclosure */}
        {prices.length > 0 && (
          <div className="mt-12 pt-8 border-t border-[#c9a84c]/20">
            <p className="text-[#8aaa7a] text-sm text-center">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Affiliate Disclosure
              </span>
              <br />
              We may earn a commission from purchases made through our links. This helps support CigarScanner at no extra cost to you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
