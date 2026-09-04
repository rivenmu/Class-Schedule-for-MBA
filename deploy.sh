#!/usr/bin/env bash
# MBA 课表站一键更新 (compose 版): 拉代码 -> 注入配置 -> 覆盖站点 -> rebuild API.
# 配置只填一次 (~/.mba-deploy.env), 以后每次更新只跑: bash deploy.sh
# 约定: 仓库里的占位符永远不动 (保单文件离线可用), 真值只 sed 进服务器那份拷贝.
set -euo pipefail
cd "$(dirname "$0")"

# ---- 一次性配置 (按你的环境改这几行, 或写进 ~/.mba-deploy.env) ----
SITE_DIR="${SITE_DIR:-/opt/1panel/www/sites/mba-rivenmu-cn/index}"
if [ -f "$HOME/.mba-deploy.env" ]; then set -a; . "$HOME/.mba-deploy.env"; set +a; fi
LOGTO_ISSUER="${LOGTO_ISSUER:?先填 LOGTO_ISSUER, 如 https://login.rivenmu.cn:20001/oidc}"
LOGTO_CLIENT_ID="${LOGTO_CLIENT_ID:?先填 LOGTO_CLIENT_ID}"

# ---- 拉代码 (没 git 的机器就跳过, 直接用当前目录文件部署) ----
if [ -d .git ]; then git pull --ff-only; fi

# ---- 前端: 拷贝 + 注入真值 (仓库占位符不动) ----
sed "s|https://login.你的域名/oidc|$LOGTO_ISSUER|g; s|PASTE_LOGTO_APP_ID|$LOGTO_CLIENT_ID|g" \
  MBA-Schedule.html > "$SITE_DIR/MBA-Schedule.html"

# ---- 后端: compose rebuild (仓库即 build 上下文, 不拷文件, 不碰 env) ----
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "^api/"; then
  docker compose -f docker-compose.yml up -d --build
else
  echo ">>> api 无变更, 跳过 rebuild"
fi
echo ">>> 完成: $(grep -o 'const VERSION = "[^"]*"' "$SITE_DIR/MBA-Schedule.html")"
curl -s http://127.0.0.1:3000/api/health || echo ">>> API 未响应, 去 1Panel 编排看 mba-schedule 日志"
