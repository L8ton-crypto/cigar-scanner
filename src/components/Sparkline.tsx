'use client';

interface SparklineProps {
  data: { date: string; price: number }[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 120, height = 32, color }: SparklineProps) {
  // Don't render if no data or only 1 point
  if (!data || data.length <= 1) {
    return null;
  }

  // Extract prices for calculations
  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // If all prices are the same, show a flat line
  const isFlat = priceRange === 0;
  
  // Auto-detect trend color if not provided
  let lineColor = color;
  if (!lineColor) {
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    
    if (lastPrice < firstPrice) {
      lineColor = '#22c55e'; // green for downward trend
    } else if (lastPrice > firstPrice) {
      lineColor = '#ef4444'; // red for upward trend
    } else {
      lineColor = '#c9a84c'; // gold for flat
    }
  }

  // Create path for the sparkline
  const points: string[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * width;
    let y: number;
    
    if (isFlat) {
      y = height / 2; // Center line for flat prices
    } else {
      // Normalize price to height (inverted because SVG y=0 is top)
      y = height - ((prices[i] - minPrice) / priceRange) * height;
    }
    
    points.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }

  const pathData = points.join(' ');

  return (
    <div className="inline-block">
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {/* Optional: show min/max as tiny labels for debugging */}
        {false && ( // Set to true to debug
          <>
            <text x="2" y="8" fill="#666" fontSize="6">
              £{maxPrice.toFixed(2)}
            </text>
            <text x="2" y={height - 2} fill="#666" fontSize="6">
              £{minPrice.toFixed(2)}
            </text>
          </>
        )}
        
        {/* Main sparkline */}
        <path
          d={pathData}
          stroke={lineColor}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Optional: highlight first and last points */}
        <circle 
          cx="0" 
          cy={isFlat ? height / 2 : height - ((prices[0] - minPrice) / priceRange) * height}
          r="1" 
          fill={lineColor}
          opacity="0.7"
        />
        <circle 
          cx={width} 
          cy={isFlat ? height / 2 : height - ((prices[prices.length - 1] - minPrice) / priceRange) * height}
          r="1" 
          fill={lineColor}
        />
      </svg>
    </div>
  );
}