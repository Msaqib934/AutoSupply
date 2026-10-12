import type { NextConfig } from "next";

const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://127.0.0.1:8001";
const SUPPLIER_URL = process.env.SUPPLIER_SERVICE_URL || "http://127.0.0.1:8002";
const COMPONENT_URL = process.env.COMPONENT_SERVICE_URL || "http://127.0.0.1:8003";
const ORDER_URL = process.env.ORDER_SERVICE_URL || "http://127.0.0.1:8004";

// Optional fallback if single backend host is provided
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (BACKEND_URL) {
      return [
        {
          source: "/api/v1/:path*",
          destination: `${BACKEND_URL}/api/v1/:path*`,
        },
      ];
    }
    return [
      {
        source: "/api/v1/auth/:path*",
        destination: `${AUTH_URL}/api/v1/auth/:path*`,
      },
      {
        source: "/api/v1/suppliers",
        destination: `${SUPPLIER_URL}/api/v1/suppliers`,
      },
      {
        source: "/api/v1/suppliers/:path*",
        destination: `${SUPPLIER_URL}/api/v1/suppliers/:path*`,
      },
      {
        source: "/api/v1/components",
        destination: `${COMPONENT_URL}/api/v1/components`,
      },
      {
        source: "/api/v1/components/:path*",
        destination: `${COMPONENT_URL}/api/v1/components/:path*`,
      },
      {
        source: "/api/v1/dashboard/summary",
        destination: `${ORDER_URL}/api/v1/dashboard/summary`,
      },
      {
        source: "/api/v1/purchase-orders",
        destination: `${ORDER_URL}/api/v1/purchase-orders`,
      },
      {
        source: "/api/v1/purchase-orders/:path*",
        destination: `${ORDER_URL}/api/v1/purchase-orders/:path*`,
      },
    ];
  },
};

export default nextConfig;
