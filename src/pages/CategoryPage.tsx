import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ToolCard } from "@/components/ToolCard";
import { fetchSoftware } from "@/lib/api";
import { categoryById } from "@/lib/categories";
import type { Software } from "@/types";

/** 分区页：显示该分区下所有工具的简介卡片，点卡片进入工具详细介绍。 */
export function CategoryPage() {
  const { id = "" } = useParams();
  const meta = categoryById(id);
  const [items, setItems] = useState<Software[] | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let active = true;
    setItems(null);
    fetchSoftware("")
      .then((data) => {
        if (active) {
          setItems(data.items.filter((item) => item.categories.includes(id)));
          setFailed("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFailed(error instanceof Error ? error.message : "目录加载失败");
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!meta) {
    return (
      <div className="panel flex flex-col items-start gap-3 rounded-2xl px-6 py-10">
        <p className="text-[15px] text-ink">没有「{id}」这个分区。</p>
        <Link to="/" className="flex items-center gap-1.5 text-[13px] text-cyan">
          <ArrowLeft size={14} /> 返回分区导航
        </Link>
      </div>
    );
  }

  const { Icon, name, blurb, tint } = meta;

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
        className="flex w-fit items-center gap-1.5 font-mono text-[12px] text-faint hover:text-cyan"
      >
        <ArrowLeft size={13} /> 分区导航
      </Link>

      <header className="panel flex items-center gap-4 rounded-2xl p-6">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: `${tint}55`, background: `${tint}12`, color: tint }}
        >
          <Icon size={28} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold text-ink">{name}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{blurb}</p>
        </div>
        {items ? (
          <span className="ml-auto hidden shrink-0 font-mono text-[12px] text-faint sm:block">
            {items.length} 款工具
          </span>
        ) : null}
      </header>

      {failed ? (
        <p className="panel rounded-xl border-danger/40 px-4 py-3 text-[13px] text-danger">
          加载失败：{failed}
        </p>
      ) : null}

      {items === null && !failed ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => index).map((index) => (
            <div key={index} className="panel h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : null}

      {items && items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ToolCard key={item.name} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
