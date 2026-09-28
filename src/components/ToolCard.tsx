import { ArrowUpRight, Download } from "lucide-react";
import { Link } from "react-router-dom";

import { IconGlyph, iconColor } from "@/lib/icons";
import { categoryById } from "@/lib/categories";
import { hostLabel, linkKind } from "@/lib/routes";
import type { Software } from "@/types";

/**
 * 工具简介卡片：分区页与搜索结果共用，点进详情页。
 * compact 变体用于 AI 对话里挂出的推荐小卡。
 */
export function ToolCard({ item, compact = false }: { item: Software; compact?: boolean }) {
  const { glow } = iconColor(item.name);
  const direct = linkKind(item.download) === "direct";

  if (compact) {
    return (
      <Link
        to={`/app/${encodeURIComponent(item.name)}`}
        className="panel flex min-w-[220px] max-w-[300px] items-center gap-3 rounded-xl p-3 transition-colors hover:border-cyan/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-base-2">
          <IconGlyph name={item.name} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{item.name}</span>
          <span className="mt-0.5 block truncate text-[11px] text-faint">
            查看详细介绍与安装指引
          </span>
        </span>
        <ArrowUpRight size={14} className="shrink-0 text-faint" />
      </Link>
    );
  }

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

      <span className="mt-auto flex flex-wrap items-center gap-1.5">
        {item.categories.slice(0, 2).map((id) => {
          const meta = categoryById(id);
          return (
            <span
              key={id}
              className="rounded border border-line bg-base-2 px-1.5 py-0.5 text-[10.5px] text-faint"
            >
              {meta?.name ?? id}
            </span>
          );
        })}
        <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-faint">
          <Download size={12} strokeWidth={1.9} />
          {direct ? "直链已校验" : "官方下载页"}
        </span>
      </span>
    </Link>
  );
}
