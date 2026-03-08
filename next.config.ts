import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: '*.cgarsltd.co.uk',
      },
      {
        protocol: 'https',
        hostname: '*.smoke-king.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'cdn11.bigcommerce.com',
      },
    ],
  },
};

export default nextConfig;
