/** @type {import('next').NextConfig} */

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
  // Required for Three.js ESM modules in App Router
  transpilePackages: ['three'],
  reactStrictMode: true,

  // Production: build as standalone for self-hosted deployment
  ...(isProduction && { output: 'standalone' }),

  // Security headers and CORS configuration
  async headers() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001';
    const originsList = allowedOrigins.split(',').map(origin => origin.trim());

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },

  // Proxy WebSocket traffic through Next.js for Railway single-port deployment
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3001/socket.io/:path*',
      },
    ];
  },

  // Environment variables available to client
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
