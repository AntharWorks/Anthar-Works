/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for self-hosting (Docker/Railway). On Vercel it breaks
  // routing (blanket 404s), so only enable it when not building on Vercel.
  output: process.env.VERCEL ? undefined : 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
