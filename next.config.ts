import type { NextConfig } from "next";

/** 局域网访问 dev 时浏览器 Origin 为真实 IP；须放行否则 /_next 内部请求可能被拦截，表现为切换菜单无反应等 */
const PRIVATE_LAN_PATTERNS = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const envExtra =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.176.73.3",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    ...PRIVATE_LAN_PATTERNS,
    ...envExtra,
  ],
  /** 启用 `forbidden()` / 自定义 `app/forbidden.tsx`（403） */
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
