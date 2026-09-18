/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  generateBuildId: async () => {
    return `dashboard-build-${Date.now()}`;
  },

  // AJOUT ESSENTIEL : proxy /api/v1 vers l'API réelle
  async rewrites() {
    return [
      {
        // Toutes les requêtes /api/v1/* seront redirigées vers l'API
        source: '/api/v1/:path*',
        destination: 'https://api.numericexport.com/api/v1/:path*',  // ← ton API prod
        // En dev local : 'http://localhost:3001/api/v1/:path*'
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
