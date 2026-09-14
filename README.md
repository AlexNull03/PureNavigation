# PureNavigation

只给官方入口的软件导航站，附两个 AI 入口：安装建议、网站真伪判别。

**本站是建议站点，不是广告位。** 不收任何厂商推广费，链接全部指向官网，
下载前请自行核对域名。

## 数据

`db/data.csv` 是唯一数据源，四列固定表头：

```
软件名,官方主页,下载直链,该软件功能与描述
```

后端按文件 mtime 缓存，改完不用重启；表头不符会直接报错而不是静默兜底。
所有条目人工核对过官方域名，**宁可少一条也不放一条未经验证的链接**。

## 架构

单进程：FastAPI 既出 `/api`，也把 `pnpm build` 出来的 `dist/` 直接当静态站吐出去。

```
src/      React 19 + Vite 7 + Tailwind 4 前端
server/   FastAPI 后端
  catalog.py     读 CSV + 加权搜索
  netguard.py    URL 规范化与 SSRF 闸门（判别功能的安全边界）
  whois.py       裸连 43 端口，先问 IANA 拿 referral 再问注册局
  tls.py         443 端口两次握手 + 沿 AIA caIssuers 重建证书链
  heuristics.py  确定性红旗：品牌形似、注册时长、滥用后缀、SAN 覆盖……
  scan.py        取证编排
  llm.py         DeepSeek chat completions
  prompts.py     两个入口的越界拒绝与注入防护
  run.py         进程入口：部署时用，HOST/PORT 的默认值在这里
db/       data.csv
scripts/  deploy.sh（开发机侧一键部署）
          server-setup.sh（服务器侧：非 root 装应用，--root 装 systemd 单元）
          server-web.sh（服务器侧需 root：装/配 nginx，撞已有站点会中止而不是覆盖）
deploy/   nginx.<域名>.purenavigation.conf —— 只写 80，TLS 交给 certbot
deploy.bat  Windows 入口，双击即用（只做"找 Git Bash → 转给 deploy.sh"）
```

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 目录条数、是否已配 Key |
| GET | `/api/software?q=` | 全量或搜索 |
| POST | `/api/advise` | 安装建议，只答"装什么软件 / 怎么配这台电脑" |
| POST | `/api/inspect` | 网站判别。按 IP 限流 60 秒 6 次 |

`/api/inspect` 会真实对外发起 whois 与 TLS 连接，所以 `netguard` 先卡死：
只允许 http/https、只允许 80/443、拒绝 IP 字面量、拒绝解析到
私网/回环/链路本地/保留/组播地址（含云元数据 `169.254.0.0/16`）。

未配 `DEEPSEEK_API_KEY` 时的降级是刻意的：`/api/advise` 返回 503 并说明去哪填 Key；
`/api/inspect` 照样把客观取证文本交回你，功能不至于整块不可用。

## 本地开发

```bash
pnpm install          # pnpm 11：构建脚本审批在 pnpm-workspace.yaml 的 allowBuilds
pnpm build            # 产物 dist/，后端启动时要靠它判断能不能挂静态站
.venv/bin/uvicorn server.main:app --reload --port 8000
```

前端热更新开发另开 `pnpm dev`（3015），`vite.config.ts` 已把 `/api` 代理到 8000。

```bash
DEEPSEEK_API_KEY=sk-...   # .env，仓库里只有 .env.example 占位
```

Key 只在服务端读取，不进前端产物。

## 部署

线上地址是 **`https://alexcn.work/PureNavigation/main/`**（挂在子路径下，前面套 nginx）。

在**开发机**上一条命令跑完（构建 → 上传 → 建 venv → 装 systemd 服务 → 配 nginx → 公网自检）：

```bash
bash scripts/deploy.sh              # 读 .env 的 DEPLOY_HOST / DEPLOY_USER / WEB_DOMAIN
bash scripts/deploy.sh <host> <user>
bash scripts/deploy.sh --no-build   # 跳过前端构建
bash scripts/deploy.sh --no-web     # 只装应用，不碰 systemd 和 nginx
```

`WEB_DOMAIN` 决定加载哪份 `deploy/nginx.<域名>.purenavigation.conf`，所以两者文件名要对得上。
脚本会在需要 root 的那步前停下来要 `[y/N]` 确认 —— 这是一台在跑的机器。

**Windows 上双击 `deploy.bat` 即可**：它只负责找 Git Bash 并把参数转给 `deploy.sh`。
该文件必须保持 CRLF 行尾 + 纯 ASCII，两条都是 cmd 解析器的坑，写在文件头注释里。

`ssh` 的口令可以省掉：把公钥追加到服务器 `~/.ssh/authorized_keys` 就只连一次输一次 sudo 口令。

跑完只剩签证书一步（交互式问邮箱）：

```bash
ssh -t <user>@<host> 'sudo certbot --nginx -d alexcn.work --redirect'
```

`www.alexcn.work` 目前不解析，别一起签，否则签发失败。

关于 `.env`：脚本随包上传一份只含 `DEEPSEEK_*` 的 fragment，**只在远端还没有 `.env` 时**写入；
远端已有 `.env` 就一个字都不动 —— 把别人配好的 Key 静默清空是最糟的一种 bug。
要改密钥得 ssh 上去 `vim $HOME/purenavigation/.env` 后 `sudo systemctl restart puruenavigation`。

手工分步（排查问题时更有用）：

```bash
bash $HOME/purenavigation/scripts/server-setup.sh                       # 建 venv、装依赖、自检
sudo bash $HOME/purenavigation/scripts/server-setup.sh --root           # 装 systemd 单元
sudo env DOMAIN=alexcn.work bash $HOME/purenavigation/scripts/server-web.sh  # 装/配 nginx
```

### 挂子路径的三个必要条件

少任何一个，页面能开但接口和图标全 404：

1. nginx 用 `proxy_pass http://127.0.0.1:8000/;` —— **结尾的斜杠**把 `/PureNavigation/main/`
   前缀剥掉，后端只看得到 `/`、`/assets/…`、`/api/…`，不需要知道自己被挂在哪。
2. 前端的资源与接口路径全是**相对**的（vite `base: './'`、`src/lib/api.ts` 里 `BASE = "api"`）。
3. `location = /PureNavigation/main` 要 301 到带尾斜杠的形式，否则浏览器解析相对路径时
   会把 `api/health` 算成 `/PureNavigation/api/health`。

路由用 hash router，所以子路径下不需要服务端配合处理深链。

另外 `server/run.py` 开了 `proxy_headers=True` 且 `forwarded_allow_ips="127.0.0.1"`：
不解析 `X-Forwarded-For` 的话，所有访客在后端眼里都是 127.0.0.1，
`/api/inspect` 的按 IP 限流会变成全站共享 6 次/分钟。

最后：**云安全组要放行 80/443**，这个不在代码里，脚本碰不到。

## 已知边界

- 判别结论是**初步的技术判断**，不构成法律或权威认定。它看的是域名形态、
  注册时间、证书归属这类客观事实，看不到资金流向和主体资质。
- `tls.py` 没用 `SSLSocket.get_verified_chain()`，因为那是 Python 3.13+ 才有的，
  改成走 AIA 逐级取证书，因此 `chain_complete` 表示"是否追到自签根"，
  根证书不带 `caIssuers` 时会显示未追全 —— 这是展示信息，不参与判红。
- 品牌形似判定里，**判等只看原始拼写**：`pyth0n.org` 折叠后与 `python.org` 相等，
  恰恰意味着"像但不是"，不能放过。
