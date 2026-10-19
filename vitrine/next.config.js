/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pas de generateBuildId personnalisé - Next.js gère
  onDemandEntries: { maxInactiveAge: 25000, pagesBufferLength: 2 },
  compress: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  
  async headers() {
    return [
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
