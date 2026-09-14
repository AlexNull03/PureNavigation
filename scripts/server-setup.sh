#!/usr/bin/env bash
# 在服务器上准备 PureNavigation 的运行环境。**默认不碰系统配置**：
# 只在自己家目录里建虚拟环境、装依赖，然后把需要 root 的那两步打印出来，
# 由你自己确认后再执行 —— 这是一台在跑的机器，不该被一个脚本顺手改掉。
#
#   bash scripts/server-setup.sh              # 装应用本体（无需 sudo）
#   sudo bash scripts/server-setup.sh --root  # 装 systemd 服务并启动
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/purenavigation}"
PY_BIN="${PY_BIN:-python3}"

if [[ "${1:-}" == "--root" ]]; then
  if [[ $EUID -ne 0 ]]; then
    echo "需要 root：sudo bash scripts/server-setup.sh --root" >&2
    exit 1
  fi
  RUN_USER="${SUDO_USER:-$USER}"
  APP_DIR=$(getent passwd "$RUN_USER" | cut -d: -f6)/purenavigation

  cat > /etc/systemd/system/purenavigation.service <<UNIT
[Unit]
Description=PureNavigation
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR
# 端口、监听地址、DEEPSEEK_API_KEY 都在 .env 里，不进 unit 文件
EnvironmentFile=-$APP_DIR/.env
ExecStart=$APP_DIR/.venv/bin/uvicorn server.main:app --host \${HOST:-127.0.0.1} --port \${PORT:-8000}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable --now puruenavigation.service
  systemctl restart puruenavigation.service
  sleep 2
  systemctl --no-pager -n 20 status puruenavigation.service || true

  echo
  echo "服务已起。接下来二选一对外提供服务（这一步刻意不代你做）："
  echo "  A) 直接公网暴露 8000：把 .env 改成 HOST=0.0.0.0，并在阿里云安全组放行 8000"
  echo "  B) 走 nginx 反代（推荐）：127.0.0.1:8000 保持不变，让 nginx 监听 80 转发过来"
  exit 0
fi

echo "== 检查 Python 版本 =="
"$PY_BIN" - <<'CHECK'
import sys

if sys.version_info < (3, 11):
    sys.exit(f"需要 Python >= 3.11，当前 {sys.version.split()[0]}（用 PY_BIN=python3.12 重跑本脚本）")
print(f"Python {sys.version.split()[0]} OK")
CHECK

echo "== 虚拟环境与依赖 =="
cd "$APP_DIR"
[[ -d .venv ]] || "$PY_BIN" -m venv .venv
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r server/requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "!! 已生成 .env —— 请填入 DEEPSEEK_API_KEY 与 HOST/PORT，AI 功能才完整。"
fi

if [[ ! -f dist/index.html ]]; then
  echo "!! 缺 dist/index.html：前端没构建。本地执行 pnpm build 后重跑 deploy.sh。"
  echo "   （后端会在启动时检测这个文件，缺了就只能出接口、不出页面。）"
fi

echo
echo "== 自检 =="
./.venv/bin/python -c "from server.catalog import catalog; print('目录条数:', len(catalog()))"
echo
echo "下一步：sudo bash scripts/server-setup.sh --root"
