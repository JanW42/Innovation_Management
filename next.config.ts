import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['sql.js', 'pdfjs-dist'],
  experimental: { serverActions: { bodySizeLimit: '30mb' } }
};

export default nextConfig;
