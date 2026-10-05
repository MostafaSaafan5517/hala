import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // No other site may show Hala's pages in a frame (clickjacking). The widget's page is
        // the exception: the proxy gives it the business's own frame-ancestors policy.
        source: "/((?!widget/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
