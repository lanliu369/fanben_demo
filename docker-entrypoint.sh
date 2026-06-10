#!/bin/sh
set -e

# 非 root 无法绑定 1024 以下端口；平台若注入 PORT=80 则回退到 3000
if [ -n "${PORT}" ] && [ "${PORT}" -lt 1024 ] 2>/dev/null; then
  echo "[entrypoint] PORT=${PORT} is privileged; falling back to 3000"
  export PORT=3000
fi

export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

echo "[entrypoint] starting Next.js on ${HOSTNAME}:${PORT}"
exec node server.js
