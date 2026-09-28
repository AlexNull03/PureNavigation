import {
  AlertTriangle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchSoftware } from "@/lib/api";
import { IconGlyph, iconColor } from "@/lib/icons";
import { hostLabel, linkKind } from "@/lib/routes";
import { categoryById } from "@/lib/categories";
import type { Software } from "@/types";

type DownloadEntry = Software["downloads"][number];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => setCopied(false)
        );
      }}
      className="flex items-center gap-1.5 rounded-md border border-line bg-base-2 px-2.5 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan/45 hover:text-cyan"
    >
      <Copy size={12} strokeWidth={1.9} />
      {copied ? "已复制" : "复制"}
    </button>
  );
}

/**
 * 多平台 / 多架构的官方入口。
 * 一条一行：平台、适用的 CPU 架构、官方 URL、打开按钮。
 * 不做"帮你选好了"的自动判定 —— 判断本机架构这件事必须由用户在自己的机器上做，
 * 我们只负责把每个入口写清楚。
 */
function DownloadTable({ rows }: { rows: DownloadEntry[] }) {
  return (
    <div className="panel divide-y divide-line overflow-hidden rounded-2xl">
      {rows.map((entry, index) => (
        <div
          key={`${entry.platform}-${entry.arch}-${index}`}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                {entry.platform}
              </span>
              <span className="text-[13px] text-ink">{entry.arch}</span>
            </p>
            <p className="mt-1.5 truncate font-mono text-[12px] text-faint" title={entry.url}>
              {entry.url}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1.5 rounded-md border border-cyan/35 bg-cyan/12 px-3 py-1.5 text-[12px] text-cyan transition-colors hover:bg-cyan/20"
            >
              <Download size={13} /> 打开
            </a>
            <CopyButton text={entry.url} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 架构名词的通用解释，只在详情页出现一次。
 * 各条目里的"架构选择指导"只写该工具特有的结论，避免 28 条近乎重复的长文。
 */
function ArchPrimer() {
  return (
    <details className="panel group rounded-2xl px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-semibold text-ink">
        <Cpu size={15} className="text-cyan-dim" />
        这些名字是什么意思：架构与机型对照
        <span className="ml-auto font-mono text-[11px] text-faint group-open:rotate-180 transition-transform">
          ▾
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-4 text-[13px] leading-[1.85] text-muted">
        <p>
          安装包名字里的架构标签指 CPU 的指令集，与品牌无关。
          <span className="text-ink"> amd64、x64、x86_64 </span>
          是同一个东西，指 Intel 或 AMD 的 64 位处理器，绝大多数台式机与笔记本都属于这一类
          —— 也就是说 AMD 的 CPU 一样装 amd64 包，不存在所谓的"AMD 版"。
          <span className="text-ink"> arm64、AArch64、Apple silicon </span>
          同属 ARM 的 64 位指令集，覆盖 M 系列芯片的 Mac、骁龙 X 系列的 Windows 笔记本，
          以及部分国产 ARM 设备。此外还有 x86 或 x64 之外的
          <span className="text-ink"> riscv64、loongarch64（龙芯）</span>
          等：龙芯使用自研的 LoongArch 指令集，既不是 x86 也不是 ARM，x86 的安装包在其上无法运行。
        </p>
        <p>
          判断自己的机器该选哪一个：
          <br />
          Windows —— 打开「设置 → 系统 → 关于」看「系统类型」，显示「基于 x64 的计算机」就取
          x64/amd64，显示「基于 ARM64」就取 arm64；也可以在命令提示符里执行
          <span className="mx-1 rounded bg-base-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">
            echo %PROCESSOR_ARCHITECTURE%
          </span>
          得到 AMD64 或 ARM64。
          <br />
          macOS —— 点左上角苹果菜单选「关于本机」，「芯片」一栏写 M1 至 M5 即 Apple
          Silicon（arm64），写 Intel Core 即 x86_64；或在终端执行
          <span className="mx-1 rounded bg-base-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">
            uname -m
          </span>
          得到 arm64 或 x86_64。
          <br />
          Linux —— 终端执行
          <span className="mx-1 rounded bg-base-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">
            uname -m
          </span>
          ，可能返回 x86_64、aarch64、loongarch64 或 riscv64。
        </p>
        <p>
          常见机型对照：Intel 或 AMD 的台式机与笔记本取 x64/amd64；骁龙 X Elite 一类的新款
          Windows 笔记本取 arm64；M 系列芯片的 Mac 取 Apple Silicon 版，Intel 芯片的 Mac
          取 x86_64 版；龙芯 3A5000、3A6000 等设备只能使用为该平台专门编译的构建，
          官方下载页未列出即表示没有官方版本。装错的典型表现是 Windows 提示「不是此平台的应用程序」、
          macOS 提示无法打开或要求安装 Rosetta，Linux 则报 cannot execute binary file。
        </p>
      </div>
    </details>
  );
}

function Row({ label, url, badge }: { label: string; url: string; badge?: string }) {
  return (
    <div className="panel flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-faint">
          {label}
          {badge ? (
            <span className="rounded border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 normal-case tracking-normal text-cyan">
              {badge}
            </span>
          ) : null}
        </p>
        <p className="mt-1.5 truncate font-mono text-[13px] text-ink" title={url}>
          {url}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 rounded-md border border-cyan/35 bg-cyan/12 px-3 py-1.5 text-[12px] text-cyan transition-colors hover:bg-cyan/20"
        >
          {label.includes("下载") ? <Download size={13} /> : <ExternalLink size={13} />}
          打开
        </a>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  tone = "default",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "default" | "danger" | "ok";
}) {
  const frame =
    tone === "danger"
      ? "border-danger/30 bg-danger/5"
      : tone === "ok"
        ? "border-cyan/25 bg-cyan/4"
        : undefined;
  return (
    <section
      className={
        frame ? `panel rounded-2xl border p-6 ${frame}` : "panel rounded-2xl p-6"
      }
    >
      <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
        <span className={tone === "danger" ? "text-danger" : tone === "ok" ? "text-cyan" : "text-faint"}>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[13.5px] leading-[1.85] text-muted">
        {children}
      </div>
    </section>
  );
}

/** CSV 单元格里的换行 → 逐段渲染；带 "数字." 前缀的按步骤行展示。 */
function Steps({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <ol className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-0.5 shrink-0 font-mono text-[11px] text-cyan-dim">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="whitespace-pre-wrap">{line.replace(/^\d+[.、]\s*/, "")}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * 工具简介按段落渲染。
 * 以「版本」开头的段落是国内版 / 国际版差异说明，用高亮框放在正文最显眼处。
 */
function Intro({ text }: { text: string }) {
  return (
    <>
      {text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) =>
          line.startsWith("版本") ? (
            <div
              key={index}
              className="rounded-xl border border-cyan/25 bg-cyan/6 p-4 text-[13.5px] leading-[1.85] text-ink"
            >
              <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-dim">
                <ShieldAlert size={12} /> 版本差异与选择建议
              </p>
              <p className="whitespace-pre-wrap">{line}</p>
            </div>
          ) : (
            <p key={index} className="whitespace-pre-wrap">
              {line}
            </p>
          )
        )}
    </>
  );
}

export function SoftwareDetailPage() {
  const { name = "" } = useParams();
  const [item, setItem] = useState<Software | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    fetchSoftware("")
      .then((data) => {
        if (!active) {
          return;
        }
        const found = data.items.find((entry) => entry.name === name);
        setItem(found ?? null);
        setState(found ? "ready" : "missing");
      })
      .catch(() => {
        if (active) {
          setState("missing");
        }
      });
    return () => {
      active = false;
    };
  }, [name]);

  if (state === "loading") {
    return <div className="panel h-64 animate-pulse rounded-2xl" />;
  }

  if (state === "missing" || !item) {
    return (
      <div className="panel flex flex-col items-start gap-3 rounded-2xl px-6 py-10">
        <p className="text-[15px] text-ink">数据库里没有「{name}」这一条。</p>
        <Link to="/" className="flex items-center gap-1.5 text-[13px] text-cyan">
          <ArrowLeft size={14} /> 返回分区导航
        </Link>
      </div>
    );
  }

  const { fill } = iconColor(item.name);
  const direct = linkKind(item.download) === "direct";

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
        className="flex w-fit items-center gap-1.5 font-mono text-[12px] text-faint hover:text-cyan"
      >
        <ArrowLeft size={13} /> 分区导航
      </Link>

      <header className="panel flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-line bg-base-2"
          style={{ boxShadow: `0 0 34px -12px ${fill}` }}
        >
          <IconGlyph name={item.name} size={34} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold text-ink">{item.name}</h1>
          <p className="mt-1 font-mono text-[12px] text-faint">
            官方主域 <span style={{ color: fill }}>{item.domain}</span>
            {hostLabel(item.homepage) !== item.domain ? (
              <>
                <span className="mx-2 text-line-2">·</span>
                {hostLabel(item.homepage)}
              </>
            ) : null}
          </p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {item.categories.map((id) => (
              <Link
                key={id}
                to={`/category/${encodeURIComponent(id)}`}
                className="rounded border border-line bg-base-2 px-2 py-0.5 text-[11px] text-muted hover:border-cyan/40 hover:text-cyan"
              >
                {categoryById(id)?.name ?? id}
              </Link>
            ))}
          </p>
        </div>
      </header>

      {/* （1）工具的简介 */}
      <Section icon={<BookOpenText size={16} />} title="工具简介">
        <Intro text={item.description} />
      </Section>

      {/* （2）官网、下载直链、各平台各架构的官方入口、常见伪造官网与链接 */}
      <div className="flex flex-col gap-3">
        <h2 className="px-1 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          官方入口与防伪
        </h2>
        <Row label="官方主页" url={item.homepage} />
        <Row label="下载直链" url={item.download} badge={direct ? "安装包直链" : "官方下载页"} />
        <ArchPrimer />
        {item.downloads.length ? (
          <>
            <h3 className="px-1 pt-1 text-[13px] font-semibold text-ink">
              各平台与架构的官方入口
            </h3>
            <DownloadTable rows={item.downloads} />
          </>
        ) : null}
        {item.arch_guide ? (
          <Section icon={<Cpu size={16} />} title="该下载哪一个：架构与机型对照">
            <p className="whitespace-pre-wrap">{item.arch_guide}</p>
          </Section>
        ) : null}
        {item.fakes ? (
          <Section icon={<ShieldAlert size={16} />} title="常见的伪造官网与链接" tone="danger">
            <p className="whitespace-pre-wrap">{item.fakes}</p>
          </Section>
        ) : null}
      </div>

      {/* （3）通俗化解释 */}
      {item.plain_explain ? (
        <Section icon={<Eye size={16} />} title="概念说明（面向初学者）">
          <Intro text={item.plain_explain} />
        </Section>
      ) : null}

      {/* （4）安装：流程 / 注意事项 / 普遍错误 / 成功验证 */}
      <div className="flex flex-col gap-3">
        <h2 className="px-1 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          安装指引
        </h2>
        {item.install_steps ? (
          <Section icon={<Wrench size={16} />} title="基本安装流程">
            <Steps text={item.install_steps} />
          </Section>
        ) : null}
        {item.cautions ? (
          <Section icon={<AlertTriangle size={16} />} title="特别注意事项" tone="danger">
            <p className="whitespace-pre-wrap">{item.cautions}</p>
          </Section>
        ) : null}
        {item.common_errors ? (
          <Section icon={<AlertTriangle size={16} />} title="常见错误及其后果">
            <p className="whitespace-pre-wrap">{item.common_errors}</p>
          </Section>
        ) : null}
        {item.verify ? (
          <Section icon={<CheckCircle2 size={16} />} title="安装成功验证" tone="ok">
            <p className="whitespace-pre-wrap">{item.verify}</p>
          </Section>
        ) : null}
      </div>

      {/* （5）使用简介 */}
      {item.hello_world ? (
        <Section icon={<Sparkles size={16} />} title="上手第一步：Hello World">
          <p className="whitespace-pre-wrap">{item.hello_world}</p>
        </Section>
      ) : null}

      <div className="panel flex flex-col gap-3 rounded-2xl border-amber/25 bg-amber/5 p-5 sm:flex-row sm:items-center">
        <AlertTriangle size={17} className="shrink-0 text-amber" />
        <p className="flex-1 text-[12.5px] leading-relaxed text-muted">
          本站不代收、不镜像任何安装包，链接直接指向厂商服务器；也无意推荐任何第三方下载站。
          下载后请核对数字签名，遇到要求“下载器/加速组件”的一律视为非官方渠道。
        </p>
        <Link
          to="/advise"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan/35 bg-cyan/12 px-3 py-2 text-[12px] text-cyan hover:bg-cyan/20"
        >
          <Sparkles size={13} /> 让 AI 帮我配
        </Link>
      </div>
    </div>
  );
}
