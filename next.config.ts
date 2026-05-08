import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/category/:slug",
        destination: "/products",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
