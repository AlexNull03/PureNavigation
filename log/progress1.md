# PureNavigation — 进度日志 progress1

工作目录：`D:\Data\LLM\PureNavigation`（GitHub: `AlexNull03/PureNavigation`，公开仓库）
本机：Windows 11 / Git Bash / Node v24 / pnpm 11 / Python 3.12（后端跑在 `.venv`）

本文件承接 `progress.md`。从「2026-09-28 分区导航改造」起，用户提示词、工作流程、
工作结果、实际效果都记在这里。线上地址：`https://alexcn.work/PureNavigation/main/`。

---

## 2026-09-28 · 分区导航 + 首页双栏 + 详情页五板块

### 一、用户提示词（原文要点）

阅读项目文件（尤其 `log/progress.md`）后改造此项目，并把之后所有用户提示词、
agent 工作流程、工作结果、实际效果写入 `log/progress1.md`。具体 5 项：

1. 主页改成大分类卡片（编程语言、开发工具、AI 工具、计算机系统工具、虚拟机、生活与游戏
   等分区），允许一个软件同时出现在多个分区；点进大类看各工具简介卡片，再点进详细介绍页。
2. 主页分类显示区之上、标题之下的居中位置放两个框：左框「AI 协助配置」对话框（功能与原来
   相同），右框搜索框，按工具名与简介做模糊匹配。
3. 详细介绍网页内容：(1) 工具简介（官方/准确/客观）；(2) 官网、下载直链、常见伪造官网与链接；
   (3) 通俗化解释（面向小白，如编译器 vs 解释器、IDE vs 编辑器 vs 编译器的关系）；
   (4) 安装基本流程、特别注意事项、普遍错误（含后果）、安装成功验证；(5) 使用简介（Hello World）。
4. 首页提供切换按键，按下后大分类显示改为按首字母（或拼音首字母）排序。
5. AI 协助安装：按要求给安装指引；推荐本站已登记工具时，在旁边同步显示可点进详细介绍的简介
   卡片；给常见虚假网址提示、安装注意事项、安装成功验证；并把用户提问与 AI 回复按
   `时间戳.md` 写入项目目录的 `ans/`。

### 二、工作流程与决策

**唯一数据源仍是 `db/data.csv`。** 原四列扩到十二列，新增：分区、常见伪造官网与链接、
通俗化解释、安装基本流程、特别注意事项、普遍错误与后果、安装成功验证、使用简介与Hello World。
24 条逐一写满新列 —— 通俗化解释按用户点名的角度写（Python 条目讲解释型 vs 编译型，VS Code
条目讲编辑器 / 编译器 / IDE 三件套关系，Docker 条目讲容器 vs 虚拟机，JDK 条目讲 javac+JVM 与
「一次编写到处运行」）。分区用 `;` 分隔，一个软件可落多个分区（如 Qoder = 开发工具;AI工具，
Anaconda = 编程语言;开发工具;AI工具）。

伪造官网一列只写已核实的官方域名 + 真实见过的仿冒形态（pyth0n.org 换字符、7-zip.cn 抢注、
各种「中文官网 / 加速版 / 汉化绿色版」二次打包），**没有编造具体假域名** —— 不确定的只描述
形态与判据，不虚构 URL。

生成 CSV 用一次性脚本跑 `csv.writer`（`QUOTE_ALL` + `lineterminator="\n"`），保证 UTF-8 无 BOM、
全 LF、引号转义正确；24 行全部校验为 12 列。脚本跑完即删。

**后端**（`server/`）：
- `catalog.py`：解析改成走 `io.StringIO` 而非 `splitlines` —— 因为安装流程列里带换行，
  `splitlines` 会把引号内的多行字段切碎。`Software` 数据类加满 8 个新字段；新增 `mentioned()`，
  用带非字母数字边界的别名正则从 AI 回复里认出提到的已登记工具（中文紧邻也算边界，
  这样「装python吗」能命中）。`visual studio` ⊂ `visual studio code` 这类包含关系做了去重，
  `Everything` 因小写词太泛用而要求原样大小写。`search()` 不变（名字与简介加权，满足需求 2 的
  模糊匹配）。
- `anslog.py`（新增）：把问答按 `年-月-日_时-分-秒.md` 落盘到 `ans/`，同一秒重复就加序号；
  写盘失败只打 stderr 警告、绝不影响对话本身。`ans/` 已进 `.gitignore` —— 公开仓库不上传访客提问。
- `main.py`：`/api/advise` 返回值加 `recommended`（命中的已登记工具列表），并在成功回复后调
  `anslog.record()`。`/api/software` 不变，前端一次拉全量后自己分区分组。
- `prompts.py`：`advise_system` 把新列全部注入目录 JSON，回答要求从「给链接」升级为
  「按 是什么→流程→注意→错误→验证→上手 说透」，并明令工具名要用条目正式名（这样前端卡片
  能对上）。补了「别输出 `---` 分隔线」—— 前端 RichText 不渲染它，会露出字面字符。
- `llm.py`：`MAX_OUTPUT_TOKENS` 1200→2000，因为结构化回答更长，1200 容易被截断。

**前端**（`src/`）：
- `lib/categories.ts`（新增）：8 个分区的展示元数据（id / 名 / 一句话说明 / lucide 图标 / 辉光色），
  `id` 必须与 CSV 分区取值逐字对齐。附 `initialOf()`（英文名取首字母，数字/其他归 `#`）与
  `groupByInitial()`（26 字母在前、`#` 垫底、组内按名排序）。
- `pages/HomePage.tsx`（新增，替代旧 `BrowsePage`）：居中标题 → 其下左「AI 协助配置」对话框
  + 右「搜索工具」输入框 → 再下是「按分区 / 按首字母排序」切换 → 分区卡片网格。搜索词非空时
  显示匹配的工具简介卡片、隐藏切换；切换按首字母时显示 A–Z/# 分组卡片。点分区卡片进 `/category/:id`。
- `pages/CategoryPage.tsx`（新增）：`/category/:id`，列出该分区全部工具简介卡片。
- `pages/SoftwareDetailPage.tsx`（重写）：详情页按需求 3 分五大板块 —— 工具简介 /
  官方入口与防伪（官网 + 直链 + 常见伪造）/ 通俗化解释 / 安装指引（流程 + 注意 + 错误后果 +
  成功验证）/ 第一次使用 Hello World。`Steps` 组件把安装流程的换行拆成带序号的步骤行。
- `components/ToolCard.tsx`（新增）：分区页与搜索共用的简介卡片，`compact` 变体用于对话框里
  挂出的推荐小卡。`RecommendedCards.tsx`（新增）：把 `mentioned` 命中的工具渲染成可点进详情页的
  横排小卡，作为 `extra` 塞进 AI 气泡下方。`ChatPanel` 加 `compact` 形态（首页限高内滚动），
  气泡支持渲染 `extra`。
- `router.tsx` 加 `/category/:id`；`types.ts` 的 `Software` 补 8 字段；`api.ts` 的 `sendAdvise`
  返回类型加 `recommended`；`AppLayout` 顶栏首项改名「分区导航」。删除旧 `BrowsePage.tsx`。

### 三、工作结果（改动清单）

新增：`server/anslog.py`、`src/lib/categories.ts`、`src/pages/HomePage.tsx`、
`src/pages/CategoryPage.tsx`、`src/components/ToolCard.tsx`、`src/components/RecommendedCards.tsx`。
重写：`db/data.csv`、`server/catalog.py`、`server/prompts.py`、`server/main.py`（局部）、
`server/llm.py`（常量）、`src/pages/SoftwareDetailPage.tsx`、`src/router.tsx`、
`src/types.ts`、`src/lib/api.ts`、`src/components/ChatPanel.tsx`、`src/layouts/AppLayout.tsx`（文案）。
删除：`src/pages/BrowsePage.tsx`。另 `.gitignore` 加 `ans/`，`README.md` 数据节改十二列并补
`anslog.py` 说明。

### 四、实际效果（本地实测，非推测）

`pnpm build`（`tsc --noEmit && vite build`）通过，产物 395.26 kB / gzip 132.65 kB，相对路径、
CSS 无外部引用。后端用 `.venv` 起在 127.0.0.1:8027，`/api/health` 返 `{"items":24,"llm_configured":true}`。

浏览器（hash router）逐项核对：
- 首页：标题之下、分区之上居中两框齐全 —— 左「AI 协助配置」对话框（占位符「请输入你需要安装的
  软件和功能」+ 3 个示例按钮），右「搜索工具」输入框。其下 8 张分区卡片，计数正确
  （编程语言 4 / 开发工具 12 / AI 工具 6 / 计算机系统工具 7 / 虚拟机与容器 1 / 数据库 1 /
  图形与制作 2 / 生活与游戏 2）。
- 搜索框输「压缩」→ 命中 2 条（FFmpeg、7-Zip），简介卡片正常渲染。
- 「按首字母排序」切换 → 24 张卡片按 A/B/C…/V/# 分组，`#` 收 7-Zip。
- 点「AI 工具」分区 → 6 张卡（Qoder/Trae/Cursor/Anaconda/Ollama/LM Studio）。
- 详情页 `#/app/Python 3.13` → 五大板块标题齐全，安装流程按 01/02/03/04 逐步渲染。
- 独立页 `/advise`、`/inspect` 未被改坏，各自标题正常。控制台全程零消息。
- **真实 DeepSeek 端到端**：在首页对话框发「我想本地跑大模型，装 Ollama 还是 LM Studio？」，
  回答按「是什么/流程/注意/错误/验证/第一次使用」结构给出，两者官方域名与「中文站/加速版是二改包」
  的防伪提示都在；回答下方挂出「本站已登记」推荐卡片（Ollama、LM Studio 以及顺带提到的 Qoder/Trae/Cursor），
  每张卡可点进对应详情页。`ans/` 下生成 `2026-09-28_15-28-53.md`，内容是完整问答 +
  「回复命中的已登记工具」列表，UTF-8 落盘正常。

⚠️ **仍未做 / 验不了的**：
1. 没上线。部署仍要你在开发机双击 `deploy.bat`（日常更安全的姿势是 `deploy.bat --no-build --no-web`
   只更代码，别碰 nginx 那份含 443 的配置）。上传的 `db/data.csv` 会随包走，服务器端十二列同样生效。
2. `take_screenshot` 本机照旧报视口不可用，**没做过像素级视觉确认** —— 布局、卡片数量、渲染出的
   标签、控制台零报错这些是结构和 DOM 层面的证据，颜色与间距观感需要你打开页面自己过一眼。
3. 推荐卡片来自「AI 回复里提到了哪些工具」的正则识别。模型若只是顺带提一句某个工具名，也会挂出
   它的卡片（本次 Ollama 问答里 Qoder/Trae/Cursor 就是这么被带出来的）。当前视为「提到的都可点」，
   没有强行过滤；要收紧的话可以只认正文主干提到的，但那需要更强的语义判断，暂不做。
4. `ans/` 里有两个测试期间留下的样例文件（`15-17-11`、`15-28-53`），因自动模式禁止 `rm` 递归删除
   没能清掉；已被 `.gitignore` 挡住，不会进公开仓库，要清的话手工删 `ans/` 目录即可。

### 五、提交与推送

- `79f37d4 首页改为分区导航：data.csv 扩到十二列，详情页五板块，AI 问答落盘 ans/` —— 22 个文件，
  已推送 `origin/main`。`ans/`、`.deploy-tmp/` 未进提交（gitignore 生效）；仓库里另发现两个
  与本轮无关的杂散目录（根下的 `C:/`、`stream_pdf/`，疑似早先路径写错留下的），本轮没有动它们。

---

## 第二轮：触发一次部署（2026-09-28）

### 一、用户提示词

> 触发一次部署

### 二、部署前的只读探测

先摸清能不能由我这侧一路跑完，结论是**不能全自动**：

- 用仓库里那份带心跳的 ssh 参数探了一把：key 免密已生效（返回 `ssh-ok`），
  systemd 服务 `purenavigation` 是 `active`，但 `sudo -n true` 失败 —— 远端 sudo **要交互口令**。
- 这一点决定了分工：上传、建 venv、装依赖、自检这些非 root 的活我能跑；
  最后那下 `systemctl restart` 得你亲自输口令，我这侧的非交互终端打不进密码。

### 三、实际执行了什么

在开发机跑了 `bash scripts/deploy.sh --no-web`（刻意不带 root 阶段，避免卡在 sudo 口令上）：

1. 本机 `pnpm build`：tsc 通过，vite 产出 `dist/`（index.js 395 KB / gzip 132 KB）。
2. tar-over-ssh 上传 `dist db server scripts deploy` 到 `$HOME/purenavigation`；
   远端已有 `.env`，脚本只补缺键、已有内容一个字没动（DeepSeek Key 保持）。
3. 远端 `server-setup.sh`（非 root）：Python 3.12.3、建 venv、装依赖，**自检目录条数 24**。

落盘后用只读 ssh 复核，新代码确实进了服务器磁盘：`server/anslog.py`、`server/catalog.py` 在位，
`db/data.csv` 是十二列表头、97 个物理行（24 条逻辑记录，因为引号单元格内嵌了换行）。

### 四、当前状态：新代码在盘上，服务还跑旧的

对着公网 `GET /api/software` 验了一遍，返回里**没有** `categories` / `fakes` 字段 ——
即线上仍是旧后端。原因很实在：`deploy.sh --no-web` 走的是非 root 段，而 `systemctl restart`
只在 `--root` 段里；systemd 服务还驻着改代码之前的进程。新前端依赖后端这些新字段，
所以这次更新**必须重启一次**才对得上。

### 五、需要你做的一步（就差 sudo 重启）

在开发机粘贴这一条，输一次你的 sudo 口令即可：

```bash
ssh -t ${DEPLOY_USER}@${DEPLOY_HOST} 'sudo systemctl restart purenavigation'
```

重启后复验（判据：出现 `categories` 字段即新代码已上线）：

```bash
curl -s --resolve ${WEB_DOMAIN}:443:${DEPLOY_HOST} \
  https://${WEB_DOMAIN}/PureNavigation/main/api/software | tr ',' '\n' | grep -m1 categories
```

或直接开 `https://${WEB_DOMAIN}/PureNavigation/main/` 看首页分区卡片、搜索框、详情五板块是否生效。

⚠️ 别为了这次更新去走完整 `deploy.bat` 的 `[y]` root 段：那会连带重跑 nginx 配置，而 certbot 把 443 块
写进了同一份 `conf.d` 文件，`server-web.sh` 的覆盖护栏会主动中止（这是设计如此）。systemd 单元早就装好了，
这次只差一次 `restart`，上面那条命令就够。

（host/user/domain 用占位符写，仓库是公开的，不把公网 IP 与 SSH 用户名字面提交进来。）

### 六、本轮提交

本轮只改 `log/progress1.md`（把这次部署的过程、结果、和「等你重启」这一步记下来），代码零改动。

---

## 2026-09-28 · 第二轮改造：紧凑首页 + 文案专业化 + 4 个新工具 + 多架构指导

### 一、用户提示词（原文要点）

1. AI 协助安装模块与搜索模块的框面积过大，缩小成一个输入框的模样；AI 那个点击输入后弹出一个
   稍大一点的对话窗口。
2. 各工具详细介绍页的内容（包括模块的 title 与文本）过于口语化且不专业；介绍与指导过短，
   对真正的初学者没有实际用处，要求重新构思，务必专业且详实（对小白的通俗介绍可以通俗，
   但语气不要口语化）。
3. 添加内容：VMware、VirtualBox、Windows 沙盒、PowerToys。
4. 修改内容：Qoder 界面对 Qoder 与 Qoder CN 的差别作出说明，Trae 界面对 Trae 与 Trae CN 的区别
   在醒目处说明；优先推荐 CN，国际版放在 CN 版之后。
5. 详细介绍界面：提供 amd64、arm64 不同安装包的软件，界面要对两种架构解释说明；下载直链给出
   （如果有）Windows、Linux、OSX 等多版本，并对骁龙芯片、龙芯、Intel 与 M 芯片的 Mac 该选哪个
   架构作出指导。
6. 完成后更新 progress.md、提交 GitHub 仓库、推送至服务器。

### 二、数据层：CSV 从 12 列扩到 14 列

`db/data.csv` 追加两列，全表 28 条（24 条原有 + 4 条新增）：

- `多版本下载`：每行 `平台|架构或适用机型|官方URL`，覆盖 Windows / macOS / Linux 与 x64、
  arm64、32 位、龙芯等条目。
- `架构选择指导`：只写该工具特有的结论（哪些架构有构建、哪类机型取哪个包、装错的表现为何）。

`server/catalog.py` 相应改动：`EXPECTED_HEADER` 加两项、新增 `Download` dataclass 与
`_parse_downloads()`。这一列按行宽松解析 —— 少写字段的行直接丢掉，不让一个坏行把
`/api/software` 打成 500。`_ALIAS_TABLE` 补 `vmware`、`virtualbox`、`windows 沙盒`、`powertoys`
四个别名；「沙盒」在日常中文里太泛（浏览器沙盒、Android 沙盒），所以只认带 Windows 的写法。

`server/prompts.py` 把条目正文注入改成两级：命中问题的条目给全文，其余只给「名字 + 官方域 +
分区 + 一句话」的索引；并对单次回答展开的条目数封顶 5 条。实测 28 条全文注入约 3.0 万 token，
会挤掉对话历史；封顶后最重的一问（点到 8 个软件）从 4.9 万字降到 3.1 万字。
`server/llm.py` 的 `MAX_OUTPUT_TOKENS` 由 2000 提到 3000 —— 文案写详实之后，1500 字以上的回答
会被旧上限截断。

### 三、文案重写怎么做的

24 条既有条目的 8 个正文字段（简介 / 防伪 / 通俗解释 / 安装流程 / 注意事项 / 普遍错误 /
成功验证 / Hello World）+ 4 条新条目全部字段，交给 6 个并行的写作任务分头完成，每个任务
都被要求：URL 必须实测存活、只允许官方域、正文用规范书面语、不用 Markdown 语法与感叹号、
普遍错误固定写成 `N. 现象：…｜原因：…｜纠正：…` 四组。

写完由本机脚本统一校验：14 键齐全且顺序一致、分区 id 合法、`平台|架构|URL` 三字段、
感叹号与 Markdown 痕迹逐行扫、URL 域名白名单（只放官方域）。「组装」这一步的产出是
`.deploy-tmp/assemble.py` + `.deploy-tmp/arch_data.py`，正式写入前先备份旧表，任一校验不过
就原文件不动。

两处事实纠正值得记下来，因为它们都是从提示词里带出来的错判：

- VirtualBox 的 Apple Silicon 宿主版本。初稿按「没有 macOS ARM 构建」写，实际官方下载页
  7.2.20 起对 Intel 与 Apple Silicon 分别出包，改了 4 处文字。
- `learn.microsoft.com` 下 Windows Sandbox 的多个子页、PowerToys 的微软商店深链与 aka.ms 短链，
  逐条 curl 判活后才入库（商店产品 ID `XP89DCGQ3K6VLD` 由官方短链 301 的目标反查得到）。

### 四、国内版优先（Qoder / Trae）

这两条的 `官方主页` 与 `下载直链` 从国际域改成国内域（`qoder.com.cn`、`www.trae.cn`），
`多版本下载` 把国内版排在国际版之前；CN 与国际版的差别在四处显眼位置各写了一遍：
工具简介、概念说明、特别注意事项第 1 条、常见伪造官网。要点是账号体系与数据互不相通、
注册后无法迁移，所以必须「先定版本再注册」；另注明 `trae.cn` 对脚本抓取返回 403 属反爬，
不构成判假依据。

前端把正文里以「版本」开头的段落单独渲染成高亮框（标题「版本差异与选择建议」），
所以这两条打开就是最上面那块青色卡片，不用往下找。

### 五、界面

首页：AI 面板与搜索面板改成两条 h-11 的输入条（左 AI、右搜索），点 AI 条弹出居中层
（`max-w-3xl`，内部对话区 56vh），Enter 或 Esc 关闭；关闭只是 `hidden` 不卸载 —— 卸载会把
已经问过的几轮整段丢掉。

详情页：官方入口块下加两块。一块是可折叠的通用架构解释（amd64=x64=x86_64、arm64=AArch64、
龙芯 LoongArch 三者互不兼容，以及 Windows / macOS / Linux 各自怎么查自己机型、装错的典型报错），
只在前端写一次，避免 28 条 CSV 里重复；另一块是 `多版本下载` 渲染成的入口列表，每行给出平台、
适用机型、官方 URL 与「打开 / 复制」两个动作。之后是该工具特有的架构对照说明。

板块标题一并专业化：`概念说明（面向初学者）`、`常见错误及其后果`、`上手第一步：Hello World`。

### 六、验证

- `pnpm exec tsc --noEmit`、`pnpm build` 均通过。
- 本地起服务打 `/api/software`：28 条，`downloads` 与 `arch_guide` 字段全部有值
  （VMware 6 行 / 257 字，VirtualBox 9 行，各条普遍错误 4 组）。
- 别名匹配：`VMware 和 VirtualBox，还要开 Windows 沙盒，另外 PowerToys` → 四条全部命中；
  `vs code 和 docker desktop`、`qoder 和 trae 该用哪个` 也按预期命中。
- 搜索：`沙盒` → Windows Sandbox，`虚拟机` → VMware、VirtualBox，`powertoys` → PowerToys。
- 详情页实测（500×545 视口）：14 个板块标题齐全，架构解释折叠块 1 个，外链 8 条
  （官方主页 + 下载直链 + 6 行多版本入口）。Qoder 页顶部域名是 `qoder.com.cn`，
  版本高亮框出现 2 处。
- 对话弹层实测：打开后 `role=dialog` 铺满视口、textarea 获焦、`body.overflow=hidden`。
- `/api/advise` 实测一问（「骁龙 X 笔记本该下 VMware 还是 VirtualBox 哪个包」）：
  AI 直接答「两者都没有 Windows on ARM 宿主构建」并建议改用系统自带 Hyper-V，
  推荐卡片挂出 VMware 与 VirtualBox 两张 —— 新列的内容确实进了模型视野，而不是只在页面上摆着。
- `ans/` 落盘正常，问答按时间戳写入。
