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
PIP_MIRROR="${PIP_MIRROR:-https://mirrors.aliyun.com/pypi/simple/}"

if [[ "${1:-}" == "--root" ]]; then
  if [[ $EUID -ne 0 ]]; then
    echo "需要 root：sudo bash scripts/server-setup.sh --root" >&2
    exit 1
  fi
  RUN_USER="${SUDO_USER:-$USER}"
  APP_DIR=$(getent passwd "$RUN_USER" | cut -d: -f6)/purenavigation
  # 单元文件名和 systemctl 参数必须同源：写成两个字面量时，其中一处手滑多一个 u
  # 就会 "Unit file puruenavigation.service does not exist"，直接 set -e 退出。
  SERVICE=purenavigation

  cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=PureNavigation
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR
# DEEPSEEK_API_KEY / HOST / PORT 都在 .env 里，不进 unit 文件
EnvironmentFile=-$APP_DIR/.env
# 监听地址的默认值写在 server/run.py 里 —— systemd 不展开 ${VAR:-...}，
# 放在 ExecStart 上，遇到 .env 缺键就会传成空参数。
ExecStart=$APP_DIR/.venv/bin/python -m server.run
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable --now $SERVICE.service
  systemctl restart $SERVICE.service
  sleep 2
  systemctl --no-pager -n 20 status $SERVICE.service || true

  echo
  echo "服务已起。接下来二选一对外提供服务（这一步刻意不代你做）："
  echo "  A) 直接公网暴露 8000：把 .env 改成 HOST=0.0.0.0，并在阿里云安全组放行 8000"
  echo "  B) 走 nginx 反代（推荐）：127.0.0.1:8000 保持不变，让 nginx 监听 80 转发过来"
  exit 0
fi

echo "== 检查 Python 版本 =="
"$PY_BIN" - <<'CHECK'
import sys

# 3.10 这个下限来自依赖自己声明的 Requires-Python（fastapi / starlette / uvicorn 都是 >=3.10）
if sys.version_info < (3, 10):
    sys.exit(f"需要 Python >= 3.10，当前 {sys.version.split()[0]}（用 PY_BIN=python3.12 重跑本脚本）")
print(f"Python {sys.version.split()[0]} OK")
CHECK

echo "== 虚拟环境与依赖 =="
cd "$APP_DIR"

# "目录存在"不等于"环境能用"：缺 python3.x-venv 时 `python3 -m venv` 会先建好
# bin/ lib/ 再在 ensurepip 那步失败，留下一个没有 pip 的空壳 —— 上次部署就死在这。
if [[ -d .venv && ! -x .venv/bin/pip ]]; then
  echo "已有的 .venv 里没有 pip（多半是上次建到一半失败），删掉重建"
  rm -rf .venv
fi
if [[ ! -d .venv ]]; then
  if ! "$PY_BIN" -m venv .venv; then
    ver=$("$PY_BIN" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
    echo "建虚拟环境失败。Ubuntu/Debian 上这一步基本都缺 ensurepip，装完再重跑：" >&2
    echo "    sudo apt-get install -y python${ver}-venv" >&2
    exit 1
  fi
fi

./.venv/bin/pip install --quiet --upgrade pip || {
  echo "PyPI 官方源装不动（服务器在国内很常见），改走阿里云镜像重试"
  export PIP_INDEX_URL="$PIP_MIRROR"
}
./.venv/bin/pip install --quiet -r server/requirements.txt

echo "== 配置 .env =="
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  echo "已生成 .env（占位），下面的合并步骤会尝试填 Key"
fi

# 把 deploy.sh 随包推来的 Key 并进 .env：**只补缺键和空值，已有非空值一个字都不动。**
# 之前是"远端有 .env 就完全不处理"，结果机器上留着一个 DEEPSEEK_API_KEY= 空值的旧文件时，
# 两个 AI 入口会静默降级成"未配置"，而部署全程一句话都不说。
FRAGMENT=.deploy-tmp/env.fragment
if [[ -s "$FRAGMENT" ]]; then
  while IFS= read -r line; do
    [[ "$line" == *=* ]] || continue
    key=${line%%=*}
    value=${line#*=}
    [[ -n "$value" ]] || continue            # 本机也没值，没什么可推的
    # 值限定在这个字符集里才敢拿去做 sed 的替换串，否则宁可让人手工填
    if [[ ! "$value" =~ ^[A-Za-z0-9._:/+-]+$ ]]; then
      echo "   跳过 $key：值里有特殊字符，请手写进 $ENV_FILE"
      continue
    fi
    if grep -q "^$key=." "$ENV_FILE"; then
      echo "   $key 已有值，保持不动"
    elif grep -q "^$key=" "$ENV_FILE"; then
      sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE" && echo "   填入 $key"
    else
      printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE" && echo "   追加 $key"
    fi
  done < "$FRAGMENT"
fi
rm -rf .deploy-tmp
chmod 600 "$ENV_FILE"

if grep -q '^DEEPSEEK_API_KEY=.' "$ENV_FILE"; then
  echo "DeepSeek Key 已配置"
else
  echo "!! $ENV_FILE 里 DEEPSEEK_API_KEY 是空的：AI 建议和 AI 判别都会返回“未配置”。"
  echo "   填法：vim $ENV_FILE，改完 sudo systemctl restart purenavigation"
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
