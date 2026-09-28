import { ArrowUpRight, LayoutGrid, ListOrdered, Search, Sparkles, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ChatPanel } from "@/components/ChatPanel";
import { RecommendedCards } from "@/components/RecommendedCards";
import { ToolCard } from "@/components/ToolCard";
import { fetchSoftware, sendAdvise } from "@/lib/api";
import { CATEGORIES, groupByInitial } from "@/lib/categories";
import type { Software } from "@/types";

const ADVISE_STARTERS = [
  "我要学 Python，帮我把环境装好",
  "VS Code 和 Visual Studio 有什么区别",
  "我想在本地跑一个大模型",
];

function AdviseBox() {
  return (
    <div className="panel flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg border border-cyan/35 bg-cyan/10">
          <Sparkles size={14} className="text-cyan" />
        </span>
        <p className="text-[14px] font-semibold text-ink">AI 协助配置</p>
        <span className="ml-auto hidden text-[11px] text-faint sm:block">
          只管装软件与配环境
        </span>
      </div>
      <ChatPanel
        compact
        hint="请输入你需要安装的软件和功能"
        placeholder="例如：我要学 Python，帮我把环境装好（Enter 发送）"
        starters={ADVISE_STARTERS}
        onSend={async (history) => {
          const outcome = await sendAdvise(history);
          return {
            reply: outcome.reply,
            note: outcome.disclaimer,
            extra: <RecommendedCards items={outcome.recommended} />,
          };
        }}
      />
    </div>
  );
}

function SearchBox({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="panel flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg border border-violet/35 bg-violet/10">
          <Search size={14} className="text-violet" />
        </span>
        <p className="text-[14px] font-semibold text-ink">搜索工具</p>
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-line bg-base-2 px-4 py-3 focus-within:border-violet/50">
        <input
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="按工具名或简介模糊搜索，例如 python、压缩"
          className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-faint transition-colors hover:text-violet"
            aria-label="清空搜索"
          >
            <X size={15} />
          </button>
        ) : null}
      </label>
      <p className="text-[11.5px] leading-relaxed text-faint">
        在工具名字与简介内容里做模糊匹配；清空后回到分区视图。
      </p>
    </div>
  );
}

function CategoryCard({
  meta,
  count,
}: {
  meta: (typeof CATEGORIES)[number];
  count: number;
}) {
  const { Icon, name, blurb, tint, id } = meta;
  return (
    <Link
      to={`/category/${encodeURIComponent(id)}`}
      className="panel group relative flex flex-col gap-4 overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: `0 24px 52px -38px ${tint}` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full blur-3xl transition-opacity opacity-30 group-hover:opacity-60"
        style={{ background: tint }}
      />
      <span
        className="flex size-12 items-center justify-center rounded-xl border"
        style={{ borderColor: `${tint}55`, background: `${tint}12`, color: tint }}
      >
        <Icon size={24} strokeWidth={1.7} />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-[16.5px] font-semibold text-ink">{name}</span>
          <span className="font-mono text-[11px] text-faint">{count} 款</span>
        </span>
        <span className="mt-1.5 block text-[12.5px] leading-relaxed text-muted">{blurb}</span>
      </span>
      <span className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-faint transition-colors group-hover:text-cyan">
        进入分区 <ArrowUpRight size={13} />
      </span>
    </Link>
  );
}

export function HomePage() {
  const [allItems, setAllItems] = useState<Software[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searchItems, setSearchItems] = useState<Software[] | null>(null);
  const [searchFailed, setSearchFailed] = useState("");
  const [byLetter, setByLetter] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSoftware("")
      .then((data) => {
        if (active) {
          setAllItems(data.items);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(`目录加载失败：${error instanceof Error ? error.message : "未知错误"}`);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // 搜索词按名字与简介做服务端模糊匹配（加权打分），带 220ms 防抖。
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSearchItems(null);
      setSearchFailed("");
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchSoftware(term);
        if (active) {
          setSearchItems(data.items);
          setSearchFailed("");
        }
      } catch (error) {
        if (active) {
          setSearchFailed(error instanceof Error ? error.message : "搜索失败");
        }
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const counts = new Map<string, number>();
  for (const item of allItems ?? []) {
    for (const id of item.categories) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const letterGroups =
    byLetter && allItems ? groupByInitial(allItems, (item) => item.name) : null;

  let body: ReactNode;
  if (loadError) {
    body = (
      <p className="panel rounded-xl border-danger/40 px-4 py-3 text-[13px] text-danger">
        {loadError}
      </p>
    );
  } else if (query.trim()) {
    body = searchFailed ? (
      <p className="panel rounded-xl border-danger/40 px-4 py-3 text-[13px] text-danger">
        搜索失败：{searchFailed}
      </p>
    ) : searchItems === null ? (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => index).map((index) => (
          <div key={index} className="panel h-40 animate-pulse rounded-xl" />
        ))}
      </div>
    ) : searchItems.length ? (
      <>
        <p className="font-mono text-[11px] text-faint">
          匹配到 {searchItems.length} 个工具 · 关键词「{query.trim()}」
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {searchItems.map((item) => (
            <ToolCard key={item.name} item={item} />
          ))}
        </div>
      </>
    ) : (
      <div className="panel flex flex-col items-start gap-2 rounded-xl px-5 py-8">
        <p className="text-[14px] text-ink">数据库里暂时没有匹配「{query.trim()}」的条目。</p>
        <p className="text-[12.5px] leading-relaxed text-muted">
          可以试试左边对话框问 AI；本站不会为了凑数而给出未经验证的链接。
        </p>
      </div>
    );
  } else if (letterGroups) {
    body = (
      <div className="flex flex-col gap-7">
        {[...letterGroups.entries()].map(([letter, items]) => (
          <section key={letter} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-3">
              <span className="font-mono text-[15px] font-bold text-cyan">{letter}</span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[11px] text-faint">{items.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ToolCard key={item.name} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  } else if (allItems === null) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => index).map((index) => (
          <div key={index} className="panel h-44 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((meta) => (
          <CategoryCard key={meta.id} meta={meta} count={counts.get(meta.id) ?? 0} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col items-center gap-6 text-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-dim">
            official sources only
          </p>
          <h1 className="mt-2 text-[26px] font-semibold leading-snug text-ink sm:text-[32px]">
            按分区找工具，只给你官方主页和官方下载直链
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            搜索引擎前排经常是带全家桶的下载站、抢注的“中文官网”、甚至仿冒域名。
            这里每一个工具都人工核对过官方域名与下载入口，并写清安装流程与初学者最容易踩的坑。
          </p>
        </div>

        {/* 标题之下、分区显示区之上：左边 AI 协助配置，右边搜索框。 */}
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <AdviseBox />
          <SearchBox query={query} onChange={setQuery} />
        </div>

        {/* 首页切换：分区视图 ↔ 首字母排序视图 */}
        {!query.trim() ? (
          <div className="panel inline-flex items-center gap-1 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setByLetter(false)}
              className={
                !byLetter
                  ? "flex items-center gap-1.5 rounded-lg bg-cyan/15 px-3 py-1.5 text-[12.5px] text-cyan"
                  : "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-faint hover:text-ink"
              }
            >
              <LayoutGrid size={13} /> 按分区
            </button>
            <button
              type="button"
              onClick={() => setByLetter(true)}
              className={
                byLetter
                  ? "flex items-center gap-1.5 rounded-lg bg-cyan/15 px-3 py-1.5 text-[12.5px] text-cyan"
                  : "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] text-faint hover:text-ink"
              }
            >
              <ListOrdered size={13} /> 按首字母排序
            </button>
          </div>
        ) : null}
      </section>

      {body}
    </div>
  );
}
