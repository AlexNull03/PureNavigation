import { ArrowUpRight, Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { IconGlyph, iconColor } from "@/lib/icons";
import { fetchSoftware } from "@/lib/api";
import { hostLabel, linkKind } from "@/lib/routes";
import type { Software } from "@/types";

function SoftwareCard({ item }: { item: Software }) {
  const { glow } = iconColor(item.name);
  const direct = linkKind(item.download) === "direct";

  return (
    <Link
      to={`/app/${encodeURIComponent(item.name)}`}
      className="panel group relative flex flex-col gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:border-cyan/40"
      style={{ boxShadow: `0 20px 44px -34px ${glow}` }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-base-2">
          <IconGlyph name={item.name} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{item.name}</span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
            {hostLabel(item.homepage)}
          </span>
        </span>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-faint transition-colors group-hover:text-cyan"
        />
      </div>

      <p className="line-clamp-3 text-[12.5px] leading-relaxed text-muted">{item.description}</p>

      <span className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-faint">
        <Download size={12} strokeWidth={1.9} />
        {direct ? "官方直链已校验" : "官方下载页"}
      </span>
    </Link>
  );
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [items, setItems] = useState<Software[] | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchSoftware(query);
        if (active) {
          setItems(data.items);
          setFailed("");
        }
      } catch (error) {
        if (active) {
          setFailed(`目录加载失败：${error instanceof Error ? error.message : "未知错误"}`);
        }
      }
    }, query ? 220 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-dim">
            official sources only
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-snug text-ink sm:text-[32px]">
            找软件，只给你官方主页和官方下载直链
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            搜索引擎前排经常是带全家桶的下载站、抢注的“中文官网”、甚至仿冒域名。
            这里每一条都人工核对过官方域名与下载入口，并写明初学者最容易踩的坑。
          </p>
        </div>

        <label className="panel flex items-center gap-3 rounded-xl px-4 py-3 focus-within:border-cyan/50">
          <Search size={17} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) {
                next.set("q", event.target.value);
              } else {
                next.delete("q");
              }
              setParams(next, { replace: true });
            }}
            placeholder="搜索软件名、用途或官方域名，例如 python、视频、IDE"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("q");
                setParams(next, { replace: true });
              }}
              className="shrink-0 font-mono text-[11px] text-faint hover:text-cyan"
            >
              清空
            </button>
          ) : null}
        </label>
      </section>

      {failed ? (
        <p className="panel rounded-xl border-danger/40 px-4 py-3 text-[13px] text-danger">
          {failed}
        </p>
      ) : null}

      {items === null && !failed ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => index).map((index) => (
            <div key={index} className="panel h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <SoftwareCard key={item.name} item={item} />
          ))}
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <div className="panel flex flex-col items-start gap-2 rounded-xl px-5 py-8">
          <p className="text-[14px] text-ink">数据库里暂时没有「{query}」这一条。</p>
          <p className="text-[12.5px] leading-relaxed text-muted">
            可以去 <Link to="/advise" className="text-cyan underline decoration-cyan/40">AI 安装建议</Link>
            ，它会告诉你如何自己确认官方域名；本站不会为了凑数而给出未经验证的链接。
          </p>
        </div>
      ) : null}
    </div>
  );
}
