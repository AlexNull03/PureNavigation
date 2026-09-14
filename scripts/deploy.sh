#!/usr/bin/env bash
# 从本机把 PureNavigation 推到服务器并跑起来。
#
#   bash scripts/deploy.sh                 # 用 .env 里的 DEPLOY_HOST / DEPLOY_USER
#   bash scripts/deploy.sh 1.2.3.4 alex    # 显式指定
#   bash scripts/deploy.sh --no-build      # 跳过前端构建，只推后端
#
# 用 tar-over-ssh 而不是 rsync：Git Bash 默认不带 rsync，tar 一定带。
# 只推运行时需要的东西（dist / db / server / scripts），不推 .env ——
# 服务器上的 .env 里有它自己的 DEEPSEEK_API_KEY，覆盖会把它清成空。
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
cd "$REPO"

BUILD=1
while [[ ${1:-} == --* ]]; do
  case "$1" in
    --no-build) BUILD=0 ;;
    *) echo "未知参数：$1" >&2; exit 1 ;;
  esac
  shift
done

HOST_ARG="${1:-}"
USER_ARG="${2:-}"

if [[ -f .env ]]; then
  # 只取需要的两个键，不 source 整个文件（.env 里可能有会破坏本脚本的值）
  DEPLOY_HOST=$(grep -m1 '^DEPLOY_HOST=' .env | cut -d= -f2)
  DEPLOY_USER=$(grep -m1 '^DEPLOY_USER=' .env | cut -d= -f2)
fi
HOST="${HOST_ARG:-${DEPLOY_HOST:-}}"
USER_NAME="${USER_ARG:-${DEPLOY_USER:-alex}}"

if [[ -z "$HOST" ]]; then
  echo "不知道要部署到哪台机器：给两个参数（bash scripts/deploy.sh <host> <user>），或在本机 .env 里写 DEPLOY_HOST。" >&2
  exit 1
fi

REMOTE_HOME=$([[ "$USER_NAME" == root ]] && echo "/root" || echo "/home/$USER_NAME")
REMOTE_DIR="$REMOTE_HOME/purenavigation"
DEST="$USER_NAME@$HOST"

if [[ $BUILD == 1 ]]; then
  echo "== 本机构建前端 =="
  pnpm build
fi

if [[ ! -f dist/index.html ]]; then
  echo "dist/index.html 不存在，服务器上的后端只会出接口、不会出页面。先跑一次 pnpm build。" >&2
  exit 1
fi

echo "== 打包上传 $DEST:$REMOTE_DIR =="
ssh -o ConnectTimeout=10 "$DEST" "mkdir -p '$REMOTE_DIR'"

tar -czf - \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  dist db server scripts .env.example \
  | ssh "$DEST" "tar -xzf - -C '$REMOTE_DIR' && sed -i 's/\r\$//' '$REMOTE_DIR'/scripts/*.sh"
# 那个 sed 不是洁癖：Windows 上的 git 常配 core.autocrlf=true，签出的 .sh 带 CRLF，
# 传过去 bash 会报 "bad interpreter / $'\r': command not found"。

echo "== 远端装环境 =="
ssh -t "$DEST" "cd '$REMOTE_DIR' && bash scripts/server-setup.sh"

cat <<NEXT

代码已就位。剩下两步要你在服务器上亲手做（脚本刻意不代替你动系统配置）：

  1. 填 Key：      vim $REMOTE_DIR/.env        # DEEPSEEK_API_KEY=sk-...
  2. 装成服务：    sudo bash $REMOTE_DIR/scripts/server-setup.sh --root
  3. 看日志：      journalctl -u puruenavigation -f

再对外提供服务，二选一：
  A) .env 里 HOST=0.0.0.0 && 阿里云安全组放行 8000
  B) 让 nginx 监听 80 反代到 127.0.0.1:8000（安全组只开 80）
NEXT
