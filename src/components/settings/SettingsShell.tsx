"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/settings/salon-profile", label: "Salon Profile" },
  { href: "/settings/business-hours", label: "Business Hours" },
  { href: "/settings/tax-billing", label: "Tax & Billing" },
  { href: "/loyalty/settings", label: "Loyalty Program" },
  { href: "/settings", label: "Notifications" },
  { href: "/settings/account", label: "Account & Security" },
  { href: "/settings/subscription", label: "Subscription" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-xl border border-[var(--border)] bg-white p-3">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Settings</p>
        <nav className="mt-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-lg px-3 py-2 text-sm font-medium",
                isActive(pathname, item.href)
                  ? "bg-[var(--primary)] text-white"
                  : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="space-y-4">{children}</div>
    </div>
  );
}
