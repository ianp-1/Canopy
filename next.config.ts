import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xumm.app',
      },
    ],
  },
};

export default nextConfig;
