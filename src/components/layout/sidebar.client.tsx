"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { ComponentType } from "react";
import { signOut } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { APP_URLS } from "~/constants/app-urls";
import { BarIcon } from "~/lib/ui/icons/bar-icon";
import { CalendarIcon } from "~/lib/ui/icons/calendar-icon";
import { GridIcon } from "~/lib/ui/icons/grid-icon";
import { LayersIcon } from "~/lib/ui/icons/layers-icon";
import { ListIcon } from "~/lib/ui/icons/list-icon";
import { LogOutIcon } from "~/lib/ui/icons/log-out-icon";
import { UploadIcon } from "~/lib/ui/icons/upload-icon";

interface NavItem {
  id: string;
  label: string;
  path: string;
  Icon: ComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: COMMON.NAV_LABELS.DASHBOARD, path: APP_URLS.DASHBOARD, Icon: GridIcon },
  { id: "trades", label: COMMON.NAV_LABELS.TRADES, path: APP_URLS.TRADES, Icon: ListIcon },
  { id: "import", label: COMMON.NAV_LABELS.IMPORT, path: APP_URLS.IMPORT, Icon: UploadIcon },
  { id: "reports", label: COMMON.NAV_LABELS.REPORTS, path: APP_URLS.REPORTS, Icon: BarIcon },
  { id: "strategies", label: COMMON.NAV_LABELS.STRATEGIES, path: APP_URLS.STRATEGIES, Icon: LayersIcon },
  { id: "journal", label: COMMON.NAV_LABELS.JOURNAL, path: APP_URLS.JOURNAL, Icon: CalendarIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [pending, startSignOut] = useTransition();

  function isActive(path: string): boolean {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  }

  return (
    <aside
      className="flex flex-col bg-surface border-r border-border py-5 px-3 shrink-0"
      style={{ width: 224 }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div
          className="flex items-center justify-center w-6 h-6 rounded-md mono font-semibold text-lg text-bg shrink-0"
          style={{ background: "var(--color-accent)", boxShadow: "0 0 16px var(--accent-glow)" }}
        >
          {COMMON.BRAND.LOGO}
        </div>
        <div>
          <div className="font-semibold text-md text-text tracking-mono">{COMMON.BRAND.NAME}</div>
          <div className="mono text-xs text-text-mute tracking-wide">{COMMON.BRAND.VERSION}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-px mt-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.id}
              href={item.path}
              className="relative flex items-center gap-2.5 px-2.5 py-2 rounded text-md transition-colors duration-120 hover:text-text"
              style={{
                background: active ? "var(--color-surface-2)" : "transparent",
                color: active ? "var(--color-text)" : "var(--color-text-dim)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {active && (
                <span
                  className="absolute rounded-xs"
                  style={{ left: -12, top: 6, bottom: 6, width: 2, background: "var(--color-accent)" }}
                />
              )}
              <span
                className="flex w-4.5 shrink-0"
                style={{ color: active ? "var(--color-accent)" : "inherit" }}
              >
                <item.Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Session stats */}
      <div className="mt-4.5 pt-2.5 border-t border-border">
        <div className="label-caps mb-1.5">{COMMON.SESSION.LABEL}</div>
        <div className="flex justify-between text-sm mb-0.75">
          <span className="text-text-mute">{COMMON.SESSION.NET_PNL}</span>
          <span className="mono text-text-dim">—</span>
        </div>
        <div className="flex justify-between text-sm mb-0.75">
          <span className="text-text-mute">{COMMON.SESSION.TRADES}</span>
          <span className="mono text-text-dim">0</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-mute">{COMMON.SESSION.WIN_RATE}</span>
          <span className="mono" style={{ color: "var(--color-accent)" }}>—</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* User footer */}
      <div className="flex items-center gap-2.5 px-2 pt-2.5 mt-3 border-t border-border">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold text-text shrink-0"
          style={{ background: "linear-gradient(135deg, #475569, #1e293b)" }}
        >
          —
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base text-text font-medium truncate">{COMMON.USER_FOOTER.ACCOUNT}</div>
          <div className="mono text-xs text-text-mute">{COMMON.USER_FOOTER.INSTRUMENT}</div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startSignOut(async () => { await signOut(); })}
          className="p-1 rounded text-text-mute hover:text-text-dim transition-colors disabled:opacity-50"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          title={COMMON.USER_FOOTER.LOG_OUT}
        >
          <LogOutIcon />
        </button>
      </div>
    </aside>
  );
}
