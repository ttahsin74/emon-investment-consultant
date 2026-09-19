import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  distDir: process.env.CRM_BUILD_DIR || ".next",
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default nextConfig;
