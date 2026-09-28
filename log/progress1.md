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
