import { AlertTriangle, ArrowLeft, Copy, Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchSoftware } from "@/lib/api";
import { IconGlyph, iconColor } from "@/lib/icons";
import { hostLabel, linkKind } from "@/lib/routes";
import type { Software } from "@/types";

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

function Row({
  label,
  url,
  badge,
}: {
  label: string;
  url: string;
  badge?: string;
}) {
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
          <ArrowLeft size={14} /> 返回导航
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
        <ArrowLeft size={13} /> 官方导航
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
        </div>
      </header>

      <Row label="官方主页" url={item.homepage} />
      <Row
        label="下载直链"
        url={item.download}
        badge={direct ? "安装包直链" : "官方下载页"}
      />

      <section className="panel rounded-2xl p-6">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          功能与注意事项
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.85] text-muted">
          {item.description}
        </p>
      </section>

      <div className="panel flex flex-col gap-3 rounded-2xl border-amber/25 bg-amber/5 p-5 sm:flex-row sm:items-center">
        <AlertTriangle size={17} className="shrink-0 text-amber" />
        <p className="flex-1 text-[12.5px] leading-relaxed text-muted">
          本站不代收、不镜像任何安装包，链接直接指向厂商服务器；也无意推荐任何第三方下载站。
          下载后请核对数字签名，遇到要求“下载器/加速组件”的一律视为非官方渠道。
        </p>
      </div>
    </div>
  );
}
