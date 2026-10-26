import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships a serverless pdf.js build; keep it out of the client bundle.
  serverExternalPackages: ["unpdf"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
