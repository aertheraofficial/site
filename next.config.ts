import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Uploaded product photos (admin-created products and product edits).
        protocol: "https",
        hostname: "xsbzwtdoyorvhuvckckx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
