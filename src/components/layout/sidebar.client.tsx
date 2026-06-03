"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { ComponentType } from "react";
import { signOut } from "~/actions/auth";
import { COMMON } from "~/constants/copies/common";
import { APP_URLS } from "~/constants/app-urls";
import { cn } from "~/utils/cn";
import { BarIcon } from "~/lib/ui/icons/bar-icon";
import { CalendarIcon } from "~/lib/ui/icons/calendar-icon";
import { GridIcon } from "~/lib/ui/icons/grid-icon";
import { LayersIcon } from "~/lib/ui/icons/layers-icon";
import { ListIcon } from "~/lib/ui/icons/list-icon";
import { LogOutIcon } from "~/lib/ui/icons/log-out-icon";
import { UploadIcon } from "~/lib/ui/icons/upload-icon";
import { WalletIcon } from "~/lib/ui/icons/wallet-icon";
import { XIcon } from "~/lib/ui/icons/x-icon";

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
  { id: "journal",    label: COMMON.NAV_LABELS.JOURNAL,    path: APP_URLS.JOURNAL,    Icon: CalendarIcon },
  { id: "accounts",  label: COMMON.NAV_LABELS.ACCOUNTS,   path: APP_URLS.ACCOUNTS,   Icon: WalletIcon },
];

function getInitials(email?: string): string {
  if (!email) return "—";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function Sidebar({
  userEmail,
  isOpen,
  onClose,
}: {
  userEmail?: string
  isOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname();
  const [pending, startSignOut] = useTransition();
  const initials = getInitials(userEmail);

  function isActive(path: string): boolean {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-surface border-r border-border py-5 px-3 shrink-0 transition-transform duration-200",
        "md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{ width: 224 }}
    >
      {/* Mobile close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded text-text-mute hover:text-text transition-colors md:hidden"
        aria-label="Close menu"
      >
        <XIcon />
      </button>

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

      <div className="flex-1" />

      {/* User footer */}
      <div className="flex items-center gap-2.5 px-2 pt-2.5 mt-3 border-t border-border">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold text-text shrink-0"
          style={{ background: "linear-gradient(135deg, #475569, #1e293b)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base text-text font-medium truncate">{userEmail ?? COMMON.USER_FOOTER.ACCOUNT}</div>
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
