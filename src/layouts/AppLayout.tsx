import { Compass, ShieldAlert, Sparkles } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { DisclaimerBar } from "@/components/DisclaimerBar";

const NAV = [
  { to: "/", label: "官方导航", Icon: Compass },
  { to: "/advise", label: "AI 安装建议", Icon: Sparkles },
  { to: "/inspect", label: "AI 网站判别", Icon: ShieldAlert },
];

export function AppLayout() {
  return (
    <div className="grid-field min-h-dvh bg-base">
      <header className="sticky top-0 z-30 border-b border-line bg-base/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <NavLink to="/" className="group flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center rounded-xl border border-cyan/35 bg-cyan/10">
              <span className="absolute inset-0 rounded-xl bg-cyan/12 blur-md" />
              <svg viewBox="0 0 24 24" className="relative size-5" aria-hidden="true">
                <path
                  d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z"
                  fill="none"
                  stroke="var(--color-cyan)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.4" fill="var(--color-cyan)" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-mono text-[15px] font-semibold tracking-tight text-ink">
                PureNavigation
              </span>
              <span className="block text-[11px] text-faint">只给官方入口的导航站</span>
            </span>
          </NavLink>

          <nav className="ml-auto flex items-center gap-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-cyan/12 text-cyan shadow-[inset_0_0_0_1px_var(--color-line-2)]"
                      : "text-muted hover:bg-white/5 hover:text-ink",
                  ].join(" ")
                }
              >
                <Icon size={15} strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hairline h-px" />
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <Outlet />
      </main>

      <DisclaimerBar />
    </div>
  );
}
