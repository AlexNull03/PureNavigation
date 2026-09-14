import { CheckCircle2, CircleAlert, ShieldAlert, TriangleAlert } from "lucide-react";

import type { Evidence, FlagLevel } from "@/types";

const LEVEL_STYLE: Record<FlagLevel, { text: string; border: string; Icon: typeof CheckCircle2 }> = {
  ok: { text: "text-cyan", border: "border-cyan/30", Icon: CheckCircle2 },
  high: { text: "text-danger", border: "border-danger/35", Icon: ShieldAlert },
  medium: { text: "text-amber", border: "border-amber/30", Icon: TriangleAlert },
  low: { text: "text-muted", border: "border-line", Icon: CircleAlert },
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="w-[86px] shrink-0 font-mono text-[11px] text-faint">{label}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-ink">{value || "未取得"}</span>
    </div>
  );
}

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const { whois, cert } = evidence;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {evidence.flags.length === 0 ? (
          <span className="rounded-md border border-line bg-base-2 px-2 py-1 font-mono text-[11px] text-faint">
            未触发任何红旗规则
          </span>
        ) : null}
        {evidence.flags.map((flag) => {
          const style = LEVEL_STYLE[flag.level];
          return (
            <span
              key={flag.text}
              className={`flex items-center gap-1.5 rounded-md border ${style.border} bg-base-2/70 px-2 py-1 text-[11.5px] ${style.text}`}
            >
              <style.Icon size={12} strokeWidth={2} />
              {flag.text}
            </span>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-xl p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Whois · 43端口</h3>
          <div className="mt-2">
            <Fact label="注册局" value={whois.server} />
            <Fact label="注册商" value={whois.registrar} />
            <Fact label="注册时间" value={whois.created} />
            <Fact label="到期时间" value={whois.expires} />
            <Fact label="域名状态" value={whois.status.join(" / ")} />
            <Fact label="DNS" value={whois.nameservers.join(", ")} />
            {whois.error ? <Fact label="错误" value={whois.error} /> : null}
          </div>
        </section>

        <section className="panel rounded-xl p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">证书链 · 443端口</h3>
          <div className="mt-2">
            <Fact label="是否受信" value={cert.https ? (cert.trusted ? "是（校验通过）" : "否") : "无法建立 TLS"} />
            <Fact label="签发主体" value={cert.subject_cn} />
            <Fact label="签发者" value={`${cert.issuer_cn} ${cert.issuer_org}`.trim()} />
            <Fact label="签发链" value={cert.chain.join(" → ")} />
            <Fact label="覆盖域名" value={cert.san_dns.join(", ")} />
            <Fact label="有效期" value={cert.not_before ? `${cert.not_before} ~ ${cert.not_after}（剩 ${cert.days_left} 天）` : ""} />
            <Fact label="TLS" value={cert.tls_version} />
            {cert.error ? <Fact label="错误" value={cert.error} /> : null}
          </div>
        </section>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        主域 {evidence.registrable} · A 记录 {evidence.addresses.join(", ") || "无"}
        {evidence.suspect_brand
          ? ` · 与「${evidence.suspect_brand.name}」官方主域相似度 ${Math.round(evidence.suspect_brand.similarity * 100)}%`
          : ""}
      </p>
    </div>
  );
}
