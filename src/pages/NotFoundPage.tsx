import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="panel flex flex-col items-start gap-3 rounded-2xl px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-faint">404</p>
      <p className="text-[16px] text-ink">这个地址在本站没有对应的页面。</p>
      <p className="max-w-lg text-[13px] leading-relaxed text-muted">
        地址可能是手滑敲错的。从导航页进去，或直接搜软件名。
      </p>
      <Link to="/" className="mt-1 rounded-lg border border-cyan/35 bg-cyan/12 px-3 py-1.5 text-[13px] text-cyan">
        回到官方导航
      </Link>
    </div>
  );
}
