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
db/       data.csv
scripts/  部署脚本
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

```bash
bash scripts/deploy.sh              # 读 .env 的 DEPLOY_HOST / DEPLOY_USER
bash scripts/deploy.sh <host> <user>
```

脚本用 tar-over-ssh 只推运行时需要的东西（`dist` / `db` / `server` / `scripts`），
**不推 `.env`** —— 服务器上的那份有它自己的 Key。

然后在服务器上：

```bash
bash $HOME/purenavigation/scripts/server-setup.sh              # 建 venv、装依赖、自检
vim  $HOME/purenavigation/.env                                 # 填 DEEPSEEK_API_KEY
sudo bash $HOME/purenavigation/scripts/server-setup.sh --root  # 装 systemd 单元
```

脚本默认不碰系统配置，需要 root 的那步单独要 `--root`：这是一台在跑的机器。
对外提供服务二选一：`.env` 写 `HOST=0.0.0.0` 并在云安全组放行 8000，
或让 nginx 监听 80 反代到 `127.0.0.1:8000`。

## 已知边界

- 判别结论是**初步的技术判断**，不构成法律或权威认定。它看的是域名形态、
  注册时间、证书归属这类客观事实，看不到资金流向和主体资质。
- `tls.py` 没用 `SSLSocket.get_verified_chain()`，因为那是 Python 3.13+ 才有的，
  改成走 AIA 逐级取证书，因此 `chain_complete` 表示"是否追到自签根"，
  根证书不带 `caIssuers` 时会显示未追全 —— 这是展示信息，不参与判红。
- 品牌形似判定里，**判等只看原始拼写**：`pyth0n.org` 折叠后与 `python.org` 相等，
  恰恰意味着"像但不是"，不能放过。
