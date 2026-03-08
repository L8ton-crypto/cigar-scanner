'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

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

export default function CigarDetailPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/cigars/${params.id}`)
        .then(res => res.json())
        .then(data => {
          setProduct(data.cigar);
          setPrices(data.prices || []);
          setRelated(data.related || []);
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
            <h1 className="text-white text-4xl font-bold mb-6">{product.name}</h1>

            {/* Specs */}
            <div className="bg-[#1a3a2a]/60 rounded-xl p-6 mb-6">
              <h2 className="text-[#c9a84c] font-semibold mb-3">Specifications</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {product.format && <div><span className="text-[#8aaa7a]">Format:</span> <span className="text-white">{product.format}</span></div>}
                {product.strength && <div><span className="text-[#8aaa7a]">Strength:</span> <span className="text-white">{product.strength}</span></div>}
                {product.country && <div><span className="text-[#8aaa7a]">Origin:</span> <span className="text-white">{product.country}</span></div>}
                {product.length_mm && <div><span className="text-[#8aaa7a]">Length:</span> <span className="text-white">{product.length_mm}mm</span></div>}
                {product.ring_gauge && <div><span className="text-[#8aaa7a]">Ring Gauge:</span> <span className="text-white">{product.ring_gauge}</span></div>}
              </div>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#c9a84c] text-2xl font-bold">
              💰 Price Comparison
            </h2>
            {savings > 0 && (
              <span className="bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                Save up to £{savings.toFixed(2)} by comparing
              </span>
            )}
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
                      </div>
                      <a
                        href={price.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          isCheapest 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : 'bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419]'
                        }`}
                      >
                        Buy →
                      </a>
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
      </main>
    </div>
  );
}
