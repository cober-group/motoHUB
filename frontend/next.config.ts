import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Allow images from any source (Odoo base64 handled client-side)
  images: { unoptimized: true },
};

export default nextConfig;
