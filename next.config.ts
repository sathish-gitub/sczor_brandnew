import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/images/dashboard-preview.png",
        search: "?v=2",
      },
    ],
  },
};

export default nextConfig;
