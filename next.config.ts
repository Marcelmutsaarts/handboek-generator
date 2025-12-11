import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Content Security Policy - strict configuration to prevent XSS
    // In development: more permissive for Next.js dev features
    // In production: strict policy
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-eval'";

    const connectSrc = isDev
      ? "connect-src 'self' https: ws: wss:"
      : "connect-src 'self' https:";

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Allow images from self, HTTPS sources, data URIs, and blob URLs
      // This supports Supabase Storage, Pexels, AI-generated images
      "img-src 'self' https: data: blob:",
      // Allow fonts from self, HTTPS sources, and data URIs
      "font-src 'self' https: data:",
      // Allow inline styles (required for Next.js and Tailwind)
      "style-src 'self' 'unsafe-inline'",
      // Scripts: strict in production, permissive in development
      scriptSrc,
      // Connections: allow WebSocket in dev for HMR
      connectSrc,
      // Upgrade insecure requests to HTTPS
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        // Additional strict CSP for public pages
        source: "/publiek/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // HSTS - force HTTPS for 1 year (only applies in production with HTTPS)
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
