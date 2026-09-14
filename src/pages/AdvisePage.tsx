import { ChatPanel } from "@/components/ChatPanel";
import { sendAdvise } from "@/lib/api";

const STARTERS = [
  "我要学 Python，帮我把环境装好",
  "写代码用哪个编辑器？VS Code 和 Visual Studio 有什么区别",
  "帮我装 Steam 并在上面玩游戏",
  "我想在本地跑一个大模型",
];

export function AdvisePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-dim">
          ai install advisor
        </p>
        <h1 className="text-[24px] font-semibold leading-snug text-ink sm:text-[29px]">
          告诉我你要做什么，我告诉你该装什么、去哪装
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          我只回答<strong className="text-ink">安装软件与配置计算机</strong>
          相关的问题，其余请求会被直接拒绝。建议依据是本站数据库中人工核对过的官方条目，
          数据库里没有的软件，我不会编造下载链接，而是教你自己确认官方域名。
        </p>
        <p className="w-fit rounded-lg border border-amber/25 bg-amber/6 px-3 py-1.5 text-[12px] text-amber">
          这是建议，不是广告：本站不收厂商费用，推荐顺序不代表商业合作。
        </p>
      </header>

      <ChatPanel
        hint="请输入你需要安装的软件和功能"
        placeholder="例如：我要学 Python，帮我把环境装好（Enter 发送，Shift+Enter 换行）"
        starters={STARTERS}
        onSend={async (history) => {
          const outcome = await sendAdvise(history);
          return { reply: outcome.reply, note: outcome.disclaimer };
        }}
      />
    </div>
  );
}
