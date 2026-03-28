import { sql, ensureDb } from '@/lib/db';
import { slugify } from '@/lib/slugify';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Brand {
  name: string;
  count: number;
  min_price: number;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "All Cigar Brands - UK Price Comparison | Hearth & Leaf",
    description: "Browse all cigar brands available in the UK. Compare prices across multiple retailers.",
    openGraph: {
      title: "All Cigar Brands - UK Price Comparison | Hearth & Leaf",
      description: "Browse all cigar brands available in the UK. Compare prices across multiple retailers.",
      type: 'website',
      url: 'https://cigar-scanner-app.vercel.app/brands'
    }
  };
}

export default async function BrandsPage() {
  await ensureDb();
  
  // Fetch all brands with stats
  const brands = await sql`
    SELECT 
      brand as name, 
      COUNT(*) as count, 
      MIN(min_price) as min_price 
    FROM cs_products 
    GROUP BY brand 
    ORDER BY brand
  ` as Brand[];

  // Group brands by first letter
  const groupedBrands = brands.reduce((acc, brand) => {
    const firstLetter = brand.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(brand);
    return acc;
  }, {} as Record<string, Brand[]>);

  const letters = Object.keys(groupedBrands).sort();

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
                className="text-[#c9a84c] text-sm font-medium flex items-center gap-1.5"
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
          <span className="text-white">Brands</span>
        </nav>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold font-[var(--font-playfair)] text-white mb-4">
            All Brands
          </h1>
          
          <p className="text-xl text-[#8aaa7a] mb-8 max-w-2xl mx-auto">
            Discover {brands.length} cigar brands available across UK retailers
          </p>

          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-[#c9a84c] hover:text-[#b8974a] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Letter Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {letters.map(letter => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="w-10 h-10 rounded-lg bg-[#1a3a2a]/80 hover:bg-[#c9a84c] hover:text-[#0f2419] 
                       text-white text-center flex items-center justify-center font-medium 
                       transition-colors border border-[#c9a84c]/20 hover:border-[#c9a84c]"
            >
              {letter}
            </a>
          ))}
        </div>

        {/* Brands Grid by Letter */}
        <div className="space-y-12">
          {letters.map(letter => (
            <div key={letter} id={`letter-${letter}`}>
              {/* Letter Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-[#c9a84c] text-[#0f2419] 
                             flex items-center justify-center font-bold text-2xl">
                  {letter}
                </div>
                <h2 className="text-3xl font-bold font-[var(--font-playfair)] text-white">
                  {letter}
                </h2>
                <div className="flex-1 h-px bg-[#c9a84c]/20"></div>
              </div>

              {/* Brand Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {groupedBrands[letter].map(brand => (
                  <Link
                    key={brand.name}
                    href={`/brand/${slugify(brand.name)}`}
                    className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 
                             hover:bg-[#1a3a2a] transition-all hover:scale-[1.02]
                             border border-[#c9a84c]/20 hover:border-[#c9a84c]/40"
                  >
                    {/* Brand Icon */}
                    <div className="w-12 h-12 rounded-lg bg-[#c9a84c]/10 
                                  flex items-center justify-center mb-4 mx-auto">
                      <span className="text-2xl">🚬</span>
                    </div>

                    {/* Brand Name */}
                    <h3 className="text-white font-semibold text-lg text-center mb-2 leading-tight">
                      {brand.name}
                    </h3>

                    {/* Stats */}
                    <div className="text-center space-y-1">
                      <p className="text-[#8aaa7a] text-sm">
                        {brand.count} cigar{brand.count === 1 ? '' : 's'}
                      </p>
                      <p className="text-[#c9a84c] font-medium">
                        from £{Number(brand.min_price).toFixed(2)}
                      </p>
                    </div>

                    {/* Arrow Icon */}
                    <div className="flex justify-center mt-4">
                      <span className="text-[#8aaa7a] group-hover:text-[#c9a84c] transition-colors">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Back to Top */}
        <div className="text-center mt-16">
          <a 
            href="#top"
            className="inline-flex items-center gap-2 text-[#c9a84c] hover:text-[#b8974a] transition-colors"
          >
            ↑ Back to Top
          </a>
        </div>
      </main>
    </div>
  );
}