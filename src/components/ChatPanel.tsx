import { LoaderCircle, Send } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { ChatMessage } from "@/types";

export type ChatTurn = ChatMessage & { note?: string; extra?: ReactNode };

export function ChatPanel({
  placeholder,
  hint,
  starters,
  onSend,
}: {
  placeholder: string;
  hint: string;
  starters: string[];
  onSend: (
    history: ChatMessage[]
  ) => Promise<{ reply: string; note?: string; extra?: ReactNode }>;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function submit(text: string) {
    const content = text.trim();
    if (!content || busy) {
      return;
    }
    const history: ChatMessage[] = [...turns.map(({ role, content: body }) => ({ role, content: body })), { role: "user", content }];
    setTurns([...turns, { role: "user", content }]);
    setDraft("");
    setBusy(true);
    try {
      const outcome = await onSend(history);
      setTurns((current) => [
        ...current,
        { role: "assistant", content: outcome.reply, note: outcome.note, extra: outcome.extra },
      ]);
    } catch (error) {
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "请求失败，请稍后再试。",
          note: "服务未返回有效结论",
        },
      ]);
    } finally {
      setBusy(false);
      window.requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }));
    }
  }

  return (
    <div className="flex min-h-[62vh] flex-col gap-4">
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 ? (
          <div className="panel rounded-2xl px-5 py-6">
            <p className="text-[14px] text-ink">{hint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {starters.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => void submit(text)}
                  className="rounded-lg border border-line bg-base-2 px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, index) => (
          <Bubble key={index} turn={turn} />
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
        className="panel flex items-end gap-3 rounded-2xl p-3 focus-within:border-cyan/45"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit(draft);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={placeholder}
          className="max-h-48 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="flex items-center gap-1.5 rounded-xl border border-cyan/35 bg-cyan/12 px-3.5 py-2 text-[13px] text-cyan transition-colors hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
          {busy ? "思考中" : "发送"}
        </button>
      </form>
    </div>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const mine = turn.role === "user";

  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "rise max-w-[86%] rounded-2xl px-4 py-3",
          mine
            ? "border border-line-2 bg-panel-2 text-ink"
            : "panel border-cyan/22 text-muted",
        ].join(" ")}
      >
        {mine ? (
          <p className="whitespace-pre-wrap text-[13.5px] leading-[1.8]">{turn.content}</p>
        ) : (
          <RichText content={turn.content} />
        )}
        {turn.note ? (
          <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-faint">
            {turn.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function RichText({ content }: { content: string }) {
  return <div className="space-y-2 text-[13.5px] leading-[1.8]">{parseBlocks(content)}</div>;
}

/** 只输出 React 节点，不拼 HTML 字符串 —— 模型回复里出现什么都不会被当成标记执行。 */
function parseBlocks(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: string[] | null = null;

  const push = (node: ReactNode) => nodes.push(node);
  const flushParagraph = () => {
    if (paragraph.length) push(<p key={nodes.length}>{parseInline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items;
      const className = list.ordered
        ? "list-inside list-decimal space-y-1 pl-1"
        : "list-inside list-disc space-y-1 pl-1";
      push(
        <ul key={nodes.length} className={className}>
          {items.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      list = null;
    }
  };

  for (const raw of content.split("\n")) {
    const line = raw.trim();

    if (line.startsWith("```")) {
      if (fence) {
        push(
          <pre key={nodes.length} className="overflow-x-auto rounded-lg bg-base-2 p-3 font-mono text-[12.5px] text-cyan">
            {fence.join("\n")}
          </pre>,
        );
        fence = null;
      } else {
        flushParagraph();
        flushList();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(raw);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      push(
        <p key={nodes.length} className={heading[1].length > 2 ? "text-[13.5px] text-muted" : "pt-1 text-[14.5px] font-semibold text-ink"}>
          {parseInline(heading[2])}
        </p>,
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const text = (bullet ?? numbered)![1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [text] };
      } else {
        list.items.push(text);
      }
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  if (fence) push(<pre key={nodes.length} className="overflow-x-auto rounded-lg bg-base-2 p-3 font-mono text-[12.5px]">{fence.join("\n")}</pre>);
  return nodes;
}

function parseInline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="rounded bg-base-2 px-1 py-0.5 font-mono text-[12.5px] text-cyan">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
}
