import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // CR-082: /guides* proxy sang deployment vieschool-content (SEO content
  // tach repo). vercel.json rewrites khong hoat dong voi nextjs framework.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/guides-indexnow-key.txt",
          destination:
            "https://vieschool-content.vercel.app/guides-indexnow-key.txt",
        },
        {
          source: "/guides",
          destination: "https://vieschool-content.vercel.app/scn/guides",
        },
        {
          source: "/guides/:path*",
          destination:
            "https://vieschool-content.vercel.app/scn/guides/:path*",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
