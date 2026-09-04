#!/usr/bin/env bash
# MBA 课表站一键更新: 拉代码 -> 注入配置 -> 覆盖站点 -> 同步 api -> 按需装依赖.
# 配置只填一次 (~/.mba-deploy.env), 以后每次更新只跑: bash deploy.sh
# 约定: 仓库里的占位符永远不动 (保单文件离线可用), 真值只 sed 进服务器那份拷贝.
set -euo pipefail
cd "$(dirname "$0")"

# ---- 一次性配置 (按你的环境改这几行, 或写进 ~/.mba-deploy.env) ----
SITE_DIR="${SITE_DIR:-/opt/1panel/www/sites/mba-rivenmu-cn/index}"
API_DIR="${API_DIR:-/opt/1panel/www/sites/mba-rivenmu-cn/api}"
if [ -f "$HOME/.mba-deploy.env" ]; then set -a; . "$HOME/.mba-deploy.env"; set +a; fi
LOGTO_ISSUER="${LOGTO_ISSUER:?先填 LOGTO_ISSUER, 如 https://login.rivenmu.cn:20002/oidc}"
LOGTO_CLIENT_ID="${LOGTO_CLIENT_ID:?先填 LOGTO_CLIENT_ID}"

# ---- 拉代码 (没 git 的机器就跳过, 直接用当前目录文件部署) ----
if [ -d .git ]; then git pull --ff-only; fi

# ---- 前端: 拷贝 + 注入真值 (仓库占位符不动, 不用 sed -i 以兼容 macOS/Linux) ----
sed "s|https://login.你的域名/oidc|$LOGTO_ISSUER|g; s|PASTE_LOGTO_APP_ID|$LOGTO_CLIENT_ID|g" \
  MBA-Schedule.html > "$SITE_DIR/MBA-Schedule.html"

# ---- 后端: 同步代码 (永远不碰 api/.env) ----
cp api/index.js api/auth.js api/schemes.js api/package.json "$API_DIR/"
if ! cmp -s api/package.json "$API_DIR/package.json.deployed" 2>/dev/null; then
  (cd "$API_DIR" && npm install --omit=dev --no-audit --no-fund)
  cp api/package.json "$API_DIR/package.json.deployed"
  echo ">>> api 依赖变了, 去 1Panel 运行环境点一下 重启 Node, 再: curl https://mba.rivenmu.cn:20443/api/health"
else
  echo ">>> api 无变更, 无需重启"
fi
echo ">>> 完成: $(grep -o 'const VERSION = "[^"]*"' "$SITE_DIR/MBA-Schedule.html")"
