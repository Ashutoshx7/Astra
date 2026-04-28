import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Draco",
  images: { unoptimized: true },
};

export default nextConfig;
