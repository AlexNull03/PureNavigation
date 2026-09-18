#!/usr/bin/env bash
# 在服务器上把 nginx 接进来。**需要 root**。
#
#   sudo bash scripts/server-web.sh
#
# 装完之后 TLS 还没配，脚本会把 certbot 那条命令打给你 —— 它会交互式地问邮箱，
# 不适合在脚本里替你按下回车。
set -euo pipefail

APP_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
DOMAIN="${DOMAIN:-alexcn.work}"
CONF_SRC="$APP_DIR/deploy/nginx.$DOMAIN.purenavigation.conf"
CONF_DST="/etc/nginx/conf.d/purenavigation.conf"

if [[ $EUID -ne 0 ]]; then
  echo "需要 root：sudo bash scripts/server-web.sh" >&2
  exit 1
fi
if [[ ! -f "$CONF_SRC" ]]; then
  echo "找不到 $CONF_SRC（deploy.sh 的上传清单里少了 deploy/ ？）" >&2
  exit 1
fi

echo "== 装 nginx（已有就跳过）=="
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "认不出包管理器，请手动装 nginx 后重跑本脚本。" >&2
    exit 1
  fi
else
  echo "nginx 已在：$(nginx -v 2>&1)"
fi

echo "== 检查 $DOMAIN 是否已有别的 server 块 =="
EXISTING=$(grep -rlE "server_name[^;]*\b$DOMAIN\b" /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null \
  | grep -v -F "$CONF_DST" || true)
if [[ -n "$EXISTING" ]]; then
  echo "已有的配置里已经声明了 $DOMAIN，本脚本不覆盖别人的站点，请先人工合并：" >&2
  echo "$EXISTING" >&2
  echo "合并办法：把下面这个文件里的 location 段落并进那个 server 块。" >&2
  echo "  $CONF_SRC" >&2
  exit 1
fi

echo "== 落配置 =="
# nginx 反代成立的前提是后端只听 127.0.0.1。这台机器上可能留着早前生成的 .env，
# 里面 HOST 未必是回环 —— 绑到 0.0.0.0 的话 8000 会绕开 nginx 直接对公网开放，
# 按 IP 限流和 Host 头这些假设统统不成立。这里只报警，不擅自动别人的文件。
if [[ -f "$APP_DIR/.env" ]]; then
  backend_host=$(grep -m1 '^HOST=' "$APP_DIR/.env" | cut -d= -f2 || true)
  if [[ -n "$backend_host" && "$backend_host" != "127.0.0.1" && "$backend_host" != "localhost" ]]; then
    echo "!! $APP_DIR/.env 里 HOST=$backend_host —— 后端会直接对公网开放 8000，绕过 nginx。" >&2
    echo "   建议改成 HOST=127.0.0.1 后 sudo systemctl restart purenavigation，再继续。" >&2
    echo "   （云安全组里也别放行 8000。）" >&2
  fi
fi

cp "$CONF_SRC" "$CONF_DST"
nginx -t

systemctl enable --now nginx
systemctl reload nginx

echo "== 本机自测 =="
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "http://127.0.0.1/PureNavigation/main/api/health")
echo "经 nginx 打到后端 /api/health -> HTTP $code"
if [[ "$code" != "200" ]]; then
  echo "多半是应用服务没起：systemctl status purenavigation --no-pager -n 30" >&2
  exit 1
fi

cat <<NEXT

nginx 已接管 $DOMAIN 下的 /PureNavigation/main/。最后一步（会问你邮箱，交互式跑）：

  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect

注：$DOMAIN 得先在该接入商的 ICP 备案里，否则阿里云会在机房边缘按 Host 头把 80/443
拦成 "403 Server: Beaver"，HTTP-01 也过不去 —— 那种失败跟本文件无关，别在 nginx 里找原因。
NEXT
