export function DisclaimerBar() {
  return (
    <footer className="border-t border-line bg-base-2/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] leading-relaxed text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-muted">本站是建议站点，不是广告位。</span>
          不收任何厂商推广费，链接全部指向官网，下载前请自行核对域名。
        </p>
        <p className="font-mono text-[11px]">数据源：db/data.csv · 人工核对</p>
      </div>
    </footer>
  );
}
