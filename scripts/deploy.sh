#!/usr/bin/env bash
# 从本机把 PureNavigation 推到服务器并跑起来。
#
#   bash scripts/deploy.sh                 # 用 .env 里的 DEPLOY_HOST / DEPLOY_USER
#   bash scripts/deploy.sh 1.2.3.4 alex    # 显式指定
#   bash scripts/deploy.sh --no-build      # 跳过前端构建
#   bash scripts/deploy.sh --no-web        # 只装应用，不动 systemd / nginx
#
# 用 tar-over-ssh 而不是 rsync：Git Bash 默认不带 rsync，tar 一定带。
# 除 .env 本体外的东西都推（远端 .env 由 fragment 单独生成，且只在它不存在时写）。
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
cd "$REPO"

BUILD=1
WEB=1
while [[ ${1:-} == --* ]]; do
  case "$1" in
    --no-build) BUILD=0 ;;
    --no-web) WEB=0 ;;
    *) echo "未知参数：$1" >&2; exit 1 ;;
  esac
  shift
done

HOST_ARG="${1:-}"
USER_ARG="${2:-}"

if [[ -f .env ]]; then
  # 只取需要的几个键，不 source 整个文件（.env 里可能有会破坏本脚本的值）
  DEPLOY_HOST=$(grep -m1 '^DEPLOY_HOST=' .env | cut -d= -f2)
  DEPLOY_USER=$(grep -m1 '^DEPLOY_USER=' .env | cut -d= -f2)
  DEPLOY_DOMAIN=$(grep -m1 '^WEB_DOMAIN=' .env | cut -d= -f2)
fi
HOST="${HOST_ARG:-${DEPLOY_HOST:-}}"
USER_NAME="${USER_ARG:-${DEPLOY_USER:-alex}}"
DOMAIN="${DEPLOY_DOMAIN:-}"

if [[ -z "$HOST" ]]; then
  echo "不知道要部署到哪台机器：给两个参数（bash scripts/deploy.sh <host> <user>），或在本机 .env 里写 DEPLOY_HOST。" >&2
  exit 1
fi
if [[ $WEB == 1 && -z "$DOMAIN" ]]; then
  echo "对外服务需要域名：在本机 .env 里写 WEB_DOMAIN=你的域名（deploy/nginx.<域名>.purenavigation.conf 要按它找文件）。" >&2
  echo "只想先把应用装上：bash scripts/deploy.sh --no-web" >&2
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

# 模型配置随包一起走：不放进命令行参数（会出现在远端 ps 里），也不交互式让用户再填一遍。
rm -rf .deploy-tmp && mkdir -p .deploy-tmp
if [[ -f .env ]]; then
  grep -E '^(DEEPSEEK_(API_KEY|BASE_URL|MODEL)|HOST|PORT)=' .env > .deploy-tmp/env.fragment || true
fi

echo "== 打包上传 $DEST:$REMOTE_DIR，并落远端 .env =="
# 建目录 / 解包 / 去 CR / 写 .env 合成**一次** ssh：没配公钥免密时走口令认证，
# 每多一次往返就要多输一遍密码。
tar -czf - \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  dist db server scripts deploy .env.example .deploy-tmp \
  | ssh -o ConnectTimeout=10 "$DEST" \
      "mkdir -p '$REMOTE_DIR' \
       && tar -xzf - -C '$REMOTE_DIR' \
       && sed -i 's/\r\$//' '$REMOTE_DIR'/scripts/*.sh \
       && cd '$REMOTE_DIR' \
       && { if [[ -f .env ]]; then \
              echo '远端已有 .env：只补缺键和空值，已有内容不动（由 server-setup.sh 合并）'; \
            elif [[ -s .deploy-tmp/env.fragment ]]; then \
              mv .deploy-tmp/env.fragment .env && chmod 600 .env && echo '已写入远端 .env（含 DeepSeek Key）'; \
            else \
              cp .env.example .env && echo '!! 本机没有可同步的 Key，已生成占位 .env'; \
            fi; }"
# 那个 sed 不是洁癖：Windows 上的 git 常配 core.autocrlf=true，签出的 .sh 可能带 CRLF，
# 传过去 bash 会报 "bad interpreter / $'\r': command not found"。
# 已有 .env 时绝不覆盖：把别人配好的 Key 静默清空是最糟的一种 bug。
# .deploy-tmp 故意留在远端，下一步 server-setup.sh 要读它做合并，读完由它清理。

rm -rf .deploy-tmp

echo "== 远端装环境（无需 root）=="
ssh -t "$DEST" "cd '$REMOTE_DIR' && bash scripts/server-setup.sh"

if [[ $WEB == 0 ]]; then
  echo
  echo "已按 --no-web 跳过对外服务。要手工接管：sudo bash $REMOTE_DIR/scripts/server-setup.sh --root"
  exit 0
fi

echo
echo "接下来在服务器上执行需要 root 的操作："
echo "  · 装 systemd 服务单元并启动 puruenavigation"
echo "  · 装/配 nginx，把 $DOMAIN 的 /PureNavigation/main/ 反代到 127.0.0.1:8000"
echo "它会在 $REMOTE_DIR 之外的地方动 /etc/systemd 与 /etc/nginx —— 确认继续？[y/N] "
read -r REPLY_OK || REPLY_OK=""
case "$REPLY_OK" in
  y | Y) ;;
  *) echo "已中止。前两步（上传 + 建虚拟环境）已经完成，随时可以重跑本脚本。"; exit 0 ;;
esac

# DOMAIN 必须显式传：sudo 不会把本机的环境变量带过去，而 server-web.sh 要靠它拼出
# deploy/nginx.$DOMAIN.purenavigation.conf 的路径。
ssh -t "$DEST" "cd '$REMOTE_DIR' && sudo bash scripts/server-setup.sh --root && sudo env DOMAIN='$DOMAIN' bash scripts/server-web.sh"

echo
echo "== 从公网验一遍 =="
sleep 2
# 打 IP 而不是域名：这里要验的是"安全组放行 + nginx 认这个 Host"，本机 DNS 缓存没刷新
# 不该被误报成部署失败。
curl -s --max-time 20 -H "Host: $DOMAIN" "http://$HOST/PureNavigation/main/api/health" \
  || echo "外网没通：先确认云安全组放行了 80。"
echo
cat <<NEXT

上面返回 {"status":"ok","items":24,"llm_configured":true} 就说明整条链路通了。
最后签证书（交互式，会问邮箱）：

  ssh -t $DEST 'sudo certbot --nginx -d $DOMAIN --redirect'

然后就能开 https://$DOMAIN/PureNavigation/main/
NEXT
