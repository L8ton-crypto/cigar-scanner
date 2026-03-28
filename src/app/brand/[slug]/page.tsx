import { sql, ensureDb } from '@/lib/db';
import { slugify } from '@/lib/slugify';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Product {
  id: number;
  name: string;
  brand: string;
  image_url: string | null;
  format: string | null;
  strength: string | null;
  min_price: number;
  max_price: number;
  retailer_count: number;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  await ensureDb();
  const brands = await sql`SELECT DISTINCT brand FROM cs_products ORDER BY brand`;
  
  return brands.map((b) => ({
    slug: slugify(b.brand as string)
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  await ensureDb();
  const brands = await sql`SELECT DISTINCT brand FROM cs_products ORDER BY brand`;
  
  // Find brand that matches the slug
  const matchingBrand = brands.find(b => slugify(b.brand as string) === slug);
  
  if (!matchingBrand) {
    return {
      title: 'Brand Not Found',
      description: 'The requested brand could not be found.'
    };
  }

  const brandName = matchingBrand.brand as string;
  const productCount = await sql`SELECT COUNT(*) as count FROM cs_products WHERE brand = ${brandName}`;
  const count = Number(productCount[0]?.count || 0);

  return {
    title: `${brandName} Cigars - UK Prices & Reviews | Hearth & Leaf`,
    description: `Compare prices for ${brandName} cigars across UK retailers. Find the best deals on ${count} ${brandName} products.`,
    openGraph: {
      title: `${brandName} Cigars - UK Prices & Reviews | Hearth & Leaf`,
      description: `Compare prices for ${brandName} cigars across UK retailers. Find the best deals on ${count} ${brandName} products.`,
      type: 'website',
      url: `https://cigar-scanner.vercel.app/brand/${slug}`
    }
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { slug } = await params;
  await ensureDb();
  
  // Get all brands and find matching one
  const brands = await sql`SELECT DISTINCT brand FROM cs_products ORDER BY brand`;
  const matchingBrand = brands.find(b => slugify(b.brand as string) === slug);
  
  if (!matchingBrand) {
    return notFound();
  }

  const brandName = matchingBrand.brand as string;
  
  // Fetch products for this brand
  const products = await sql`
    SELECT id, name, brand, image_url, format, strength, min_price, max_price, retailer_count
    FROM cs_products 
    WHERE brand = ${brandName} 
    ORDER BY name
  ` as Product[];

  // Calculate stats
  const productCount = products.length;
  const minPrice = Math.min(...products.map(p => Number(p.min_price)));
  const maxPrice = Math.max(...products.map(p => Number(p.max_price)));
  const avgRetailerCount = Math.round(products.reduce((sum, p) => sum + p.retailer_count, 0) / productCount);

  const getStrengthColor = (strength?: string | null) => {
    if (!strength) return 'bg-gray-500';
    switch (strength.toLowerCase()) {
      case 'mild': return 'bg-green-500';
      case 'medium': return 'bg-[#c9a84c]';
      case 'full': case 'strong': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${brandName} Cigars`,
    "numberOfItems": productCount,
    "itemListElement": products.map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Product",
        "name": p.name,
        "brand": { "@type": "Brand", "name": p.brand },
        "url": `https://cigar-scanner.vercel.app/cigar/${p.id}`,
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": Number(p.min_price),
          "highPrice": Number(p.max_price),
          "priceCurrency": "GBP",
          "offerCount": p.retailer_count
        }
      }
    }))
  };

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Image 
                  src="/logo.jpg" 
                  alt="Hearth & Leaf" 
                  width={48} 
                  height={48}
                  className="rounded-lg"
                />
              </Link>
              <div>
                <Link href="/">
                  <h1 className="text-2xl font-bold font-[var(--font-playfair)] text-[#c9a84c] hover:text-[#b8974a] transition-colors">
                    Hearth & Leaf
                  </h1>
                </Link>
                <p className="text-sm text-[#8aaa7a]">CigarScanner</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/brands"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors flex items-center gap-1.5"
              >
                <span>🏷️</span> Brands
              </Link>
              <Link
                href="/deals"
                className="text-[#8aaa7a] hover:text-[#c9a84c] text-sm transition-colors flex items-center gap-1.5"
              >
                <span>💰</span> Deals
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link href="/" className="text-[#8aaa7a] hover:text-[#c9a84c] transition-colors">
            Home
          </Link>
          <span className="text-[#8aaa7a]">&gt;</span>
          <Link href="/brands" className="text-[#8aaa7a] hover:text-[#c9a84c] transition-colors">
            Brands
          </Link>
          <span className="text-[#8aaa7a]">&gt;</span>
          <span className="text-white">{brandName}</span>
        </nav>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold font-[var(--font-playfair)] text-white mb-4">
            {brandName}
            <span className="block text-[#c9a84c] text-2xl md:text-3xl mt-2">
              Cigars
            </span>
          </h1>
          
          <div className="flex justify-center gap-8 text-[#8aaa7a] mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{productCount}</div>
              <div className="text-sm">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">£{minPrice.toFixed(2)}</div>
              <div className="text-sm">From</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{avgRetailerCount}</div>
              <div className="text-sm">Avg Retailers</div>
            </div>
          </div>

          <Link 
            href="/brands"
            className="inline-flex items-center gap-2 text-[#c9a84c] hover:text-[#b8974a] transition-colors"
          >
            ← Back to All Brands
          </Link>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const minPrice = Number(product.min_price);
            const maxPrice = Number(product.max_price);
            const hasPriceRange = maxPrice > minPrice && product.retailer_count > 1;

            return (
              <div key={product.id} className="cigar-card bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4">
                {/* Image */}
                <div className="relative aspect-[3/4] mb-4 rounded-lg overflow-hidden bg-[#0a1a10]">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-[#c9a84c]/30 text-6xl">🚬</div>
                    </div>
                  )}
                  
                  {/* Retailer count badge */}
                  {product.retailer_count > 1 && (
                    <div className="absolute top-2 right-2 bg-[#c9a84c] text-[#0f2419] text-xs font-bold px-2 py-1 rounded-full">
                      {product.retailer_count} retailers
                    </div>
                  )}
                </div>

                {/* Brand */}
                <p className="text-[#c9a84c] text-sm font-medium mb-1">{product.brand}</p>

                {/* Name */}
                <h3 className="text-white font-semibold text-lg leading-tight mb-3 line-clamp-2">{product.name}</h3>

                {/* Strength & Format */}
                <div className="flex gap-2 mb-4">
                  {product.strength && (
                    <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStrengthColor(product.strength)}`}>
                      {product.strength}
                    </span>
                  )}
                  {product.format && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-[#0f2419] text-[#8aaa7a] border border-[#c9a84c]/20">
                      {product.format}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[#8aaa7a] text-xs">from</span>
                    <span className="text-[#c9a84c] text-2xl font-bold ml-1">
                      £{minPrice.toFixed(2)}
                    </span>
                  </div>
                  {hasPriceRange && (
                    <span className="text-green-400 text-xs font-medium">
                      Save up to £{(maxPrice - minPrice).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link 
                    href={`/cigar/${product.id}`}
                    className="flex-1 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] text-center py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    {product.retailer_count > 1 ? 'Compare Prices' : 'View Details'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}