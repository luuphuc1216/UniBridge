import type { NextConfig } from "next";
import { UPLOAD_BODY_SIZE_LIMIT } from "./src/lib/business-attachments/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    proxyClientMaxBodySize: UPLOAD_BODY_SIZE_LIMIT,
    serverActions: {
      bodySizeLimit: UPLOAD_BODY_SIZE_LIMIT,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
