#!/usr/bin/env bash
# 开卷手册发布: 本地单文件 -> 服务器 web/study/handbook/index.html
# 用法: bash scripts/publish_handbook.sh [html路径]
# 默认取 ../会计期末考试资料/开卷考试极速快查手册.html
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-../会计期末考试资料/开卷考试极速快查手册.html}"
HOST="${MBA_HOST:-10.0.0.2}"
DIR=/opt/mba-deploy/web/accounting_study/handbook
if [ ! -f "$SRC" ]; then echo "找不到手册: $SRC" >&2; exit 1; fi
ssh "$HOST" "mkdir -p $DIR"
scp "$SRC" "$HOST:$DIR/.index.html.tmp"
ssh "$HOST" "mv $DIR/.index.html.tmp $DIR/index.html"
echo "手册已发布: https://mba.rivenmu.cn:20001/study/handbook/"
