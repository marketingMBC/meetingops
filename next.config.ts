import type { NextConfig } from "next";

// Cabeceras de seguridad básicas (R01, 26-oct-2026). Sin CSP nueva a propósito:
// una CSP mal calibrada rompe la app; se agrega aparte, medida contra el sitio vivo.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // no revelar el stack
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
