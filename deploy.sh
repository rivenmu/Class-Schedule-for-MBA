#!/usr/bin/env bash
# MBA 课表站一键更新 (全站 compose 版): 拉代码 -> 注入配置 -> up.
# 配置只填一次 (~/.mba-deploy.env), 以后每次更新只跑: bash deploy.sh
# 约定: 仓库里的占位符永远不动 (保单文件离线可用), 真值只 sed 进 ./web 那份拷贝 (git 忽略)。
set -euo pipefail
cd "$(dirname "$0")"

if [ -f "$HOME/.mba-deploy.env" ]; then set -a; . "$HOME/.mba-deploy.env"; set +a; fi
LOGTO_ISSUER="${LOGTO_ISSUER:?先填 LOGTO_ISSUER, 如 https://login.rivenmu.cn:20001/oidc}"
LOGTO_CLIENT_ID="${LOGTO_CLIENT_ID:?先填 LOGTO_CLIENT_ID}"

if [ -d .git ]; then git pull --ff-only; fi

# 前端: 注入真值到 ./web (volume 挂进 nginx, 改完即生效, 不用 rebuild)
mkdir -p web
sed "s|https://login.你的域名/oidc|$LOGTO_ISSUER|g; s|PASTE_LOGTO_APP_ID|$LOGTO_CLIENT_ID|g" \
  MBA-Schedule.html > web/MBA-Schedule.html

# compose 真值: 同步 ~/.mba-deploy.env 到仓库根 .env (git 忽略, compose 插值用)
{
  echo "PGURL=${PGURL:?先填 PGURL, 如 postgres://mba:密码@host.docker.internal:5432/mba}"
  echo "LOGTO_ISSUER=${LOGTO_ISSUER}"
  echo "LOGTO_CLIENT_ID=${LOGTO_CLIENT_ID}"
} > .env
chmod 600 .env

# 后端: 只有 api/ 变了才 rebuild
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "^api/"; then
  docker compose -f docker-compose.yml up -d --build
else
  docker compose -f docker-compose.yml up -d --no-recreate 2>/dev/null || docker compose -f docker-compose.yml up -d
fi
echo ">>> 完成: $(grep -o 'const VERSION = "[^"]*"' web/MBA-Schedule.html)"
curl -s http://127.0.0.1:7899/api/health || echo ">>> Web/API 未响应, 去 1Panel 编排看 mba-schedule 日志"
