import { EvidencePanel } from "@/components/EvidencePanel";
import { ChatPanel } from "@/components/ChatPanel";
import { runInspect } from "@/lib/api";
import { extractSite } from "@/lib/site";

const STARTERS = ["https://download-pytorch.net", "python.org", "https://steamcn.com"];

export function InspectPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-dim">
          ai site authenticity check
        </p>
        <h1 className="text-[24px] font-semibold leading-snug text-ink sm:text-[29px]">
          贴一个网址，我查它是不是仿冒官网
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          后端会真实地做三件事：
          <strong className="text-ink">域名观察</strong>（主域形态、与官方域名的编辑距离、滥用后缀）、
          <strong className="text-ink">Whois 查询</strong>（43 端口直连注册局，看注册时间与注册商）、
          <strong className="text-ink">证书链解析</strong>（443 端口握手，沿 AIA 逐级取回签发者证书）。
          取证结果再交给模型出具初步判断。
        </p>
        <p className="w-fit rounded-lg border border-amber/25 bg-amber/6 px-3 py-1.5 text-[12px] text-amber">
          结论是初步的技术判断，不构成法律或权威认定；本站只做网站真伪判别，其余请求会被拒绝。
        </p>
      </header>

      <ChatPanel
        hint="请输入你需要判别的网站"
        placeholder="粘贴网址或域名，例如 https://download-python.net（Enter 发送）"
        starters={STARTERS}
        onSend={async (history) => {
          const question = history[history.length - 1]?.content ?? "";
          const site = extractSite(question);
          if (!site) {
            return {
              reply:
                "我没能从这句话里识别出网址。请直接粘贴要判别的域名或链接，例如 download-python.net。",
              note: "未发起网络取证",
            };
          }
          const outcome = await runInspect(site, question);
          return {
            reply: outcome.reply,
            note: outcome.disclaimer,
            extra: <EvidencePanel evidence={outcome.evidence} />,
          };
        }}
      />
    </div>
  );
}
