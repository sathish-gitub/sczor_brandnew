"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type TabKey = "SUMMARY" | "USAGE" | "WASTAGE";

const tabs: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "SUMMARY", label: "Inventory Summary", href: "/reports/inventory" },
  { key: "USAGE", label: "Usage Report", href: "/reports/inventory/usage" },
  { key: "WASTAGE", label: "Wastage Report", href: "/reports/inventory/wastage" },
];

function resolveActiveTab(pathname: string): TabKey {
  if (pathname.startsWith("/reports/inventory/usage")) {
    return "USAGE";
  }

  if (pathname.startsWith("/reports/inventory/wastage")) {
    return "WASTAGE";
  }

  return "SUMMARY";
}

/** Sub-navigation between the three inventory report pages, shown on each /reports/inventory/** page. */
export function InventoryReportTabs() {
  const pathname = usePathname();
  const activeTab = resolveActiveTab(pathname);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Reports
      </Link>

      <span className="h-5 w-px bg-[var(--border)]" aria-hidden="true" />

      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
              isActive ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
