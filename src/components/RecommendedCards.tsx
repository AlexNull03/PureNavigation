import { Sparkles } from "lucide-react";

import { ToolCard } from "@/components/ToolCard";
import type { Software } from "@/types";

/** AI 回复里提到的、本站已登记的工具 → 挂在回复旁边的简介卡片。 */
export function RecommendedCards({ items }: { items: Software[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">
        <Sparkles size={12} /> 本站已登记 · 点击查看详细介绍
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <ToolCard key={item.name} item={item} compact />
        ))}
      </div>
    </div>
  );
}
