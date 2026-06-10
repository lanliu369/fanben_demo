#!/usr/bin/env bash
# 将本机 Next（默认 3000）暴露为公网 HTTPS，供金山 WebOffice 回调调试。
# 用法：
#   终端 A：npm run dev
#   终端 B：npm run tunnel:cloudflare
# 终端 B 里会出现 https://xxxx.trycloudflare.com ，将其填到控制台「配置网关」与 WPS_CALLBACK_PUBLIC_BASE_URL。
set -euo pipefail
PORT="${PORT:-3000}"
TARGET="http://127.0.0.1:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "未找到 cloudflared，请先安装（任选其一）："
  echo "  • brew install cloudflared"
  echo "  • 官方文档：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  echo ""
  echo "若无 Homebrew，可用 npm 替代穿透（地址可能是 https://*.loca.lt）："
  echo "  npx --yes localtunnel --port ${PORT}"
  exit 1
fi

echo "→ 请确认已在另一终端运行 npm run dev，且监听端口 ${PORT}"
echo "→ Quick Tunnel 启动后，复制输出的 https://……trycloudflare.com 到 WebOffice 控制台与 .env.local"
echo ""
exec cloudflared tunnel --url "${TARGET}"
