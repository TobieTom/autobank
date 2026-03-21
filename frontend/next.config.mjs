/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Three.js ESM modules in App Router
  transpilePackages: ['three'],
  reactStrictMode: true,
};

export default nextConfig;
