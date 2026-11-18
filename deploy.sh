#!/usr/bin/env bash
# MBA 课表站一键更新 (全站 compose 版): 拉代码 -> 注入配置 -> up.
# 配置只填一次 (~/.mba-deploy.env), 以后每次更新只跑: bash deploy.sh
# 约定: 仓库里的占位符永远不动 (保单文件离线可用), 真值只 sed 进 ./web 那份拷贝 (git 忽略)。
set -euo pipefail
cd "$(dirname "$0")"

if [ -f "$HOME/.mba-deploy.env" ]; then set -a; . "$HOME/.mba-deploy.env"; set +a; fi
LOGTO_ISSUER="${LOGTO_ISSUER:?先填 LOGTO_ISSUER, 如 https://login.rivenmu.cn:20001/oidc}"
LOGTO_CLIENT_ID="${LOGTO_CLIENT_ID:?先填 LOGTO_CLIENT_ID}"

# 先拉代码再重新执行本脚本：否则 git pull 改的是“正在跑的文件”，后半段会按旧内容执行。
if [ -d .git ] && [ "${1:-}" != "--no-pull" ]; then
  git pull --ff-only
  exec bash "$0" --no-pull
fi

# 前端: 注入真值到 ./web (volume 挂进 nginx, 改完即生效, 不用 rebuild)
mkdir -p web
sed "s|https://login.你的域名/oidc|$LOGTO_ISSUER|g; s|PASTE_LOGTO_APP_ID|$LOGTO_CLIENT_ID|g" \
  MBA-Schedule.html > web/MBA-Schedule.html
# 根路径是学习区目录页；课表仍在 /MBA-Schedule.html 与 /schedule。
cp home/index.html web/index.html

# 会计练习页: /accounting_study（含手册子目录），旧的 web/study 清掉。
mkdir -p web/accounting_study
cp study/index.html web/accounting_study/index.html
rm -rf web/study

# 站点图标: 门户健康探针会拉 /favicon.svg
cp favicon.svg web/favicon.svg

# compose 真值: 同步 ~/.mba-deploy.env 到仓库根 .env (git 忽略, compose 插值用)
{
  echo "PGURL=${PGURL:?先填 PGURL, 如 postgres://mba_user:密码@iqair_db:5432/mba}"
  echo "LOGTO_ISSUER=${LOGTO_ISSUER}"
  echo "LOGTO_CLIENT_ID=${LOGTO_CLIENT_ID}"
  echo "LOGTO_ORG_ID=${LOGTO_ORG_ID:?先填 LOGTO_ORG_ID, UCAS 组织 ID}"
} > .env
chmod 600 .env

# 后端: 只有 api/ 变了才 rebuild
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "^api/"; then
  docker compose -f docker-compose.yml up -d --build
else
  docker compose -f docker-compose.yml up -d --no-recreate 2>/dev/null || docker compose -f docker-compose.yml up -d
fi

# nginx.conf 是 bind mount：文件换了但进程还读旧配置，必须 reload。
docker compose exec -T web nginx -s reload >/dev/null 2>&1 || docker compose restart web >/dev/null 2>&1 || true
echo ">>> 完成: $(grep -o 'const VERSION = "[^"]*"' web/MBA-Schedule.html)"
curl -s http://127.0.0.1:7899/api/health || echo ">>> Web/API 未响应, 去 1Panel 编排看 mba-schedule 日志"
