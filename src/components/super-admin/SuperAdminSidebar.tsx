"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ComponentType } from "react";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  Store,
  X,
} from "lucide-react";

type SuperAdminSidebarProps = {
  admin: {
    name: string;
    email: string;
  };
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const menuItems: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/salons", label: "Salons", icon: Store },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/super-admin/settings", label: "Settings", icon: Settings },
];

function toInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SuperAdminSidebar({ admin, mobileOpen, onCloseMobile }: SuperAdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={onCloseMobile}
        aria-label="Close sidebar overlay"
        className={[
          "fixed inset-0 z-30 bg-slate-950/40 transition-opacity md:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/10 bg-[#0D1B3E] transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3 text-white">
            <div className="min-w-0">
              <Link href="/super-admin/dashboard" onClick={onCloseMobile} aria-label="Go to dashboard">
                <Image
                  src="/images/sczor_logo_light.png"
                  alt="sczor"
                  width={120}
                  height={40}
                  className="h-8 w-auto cursor-pointer"
                  priority
                />
              </Link>
              <p className="mt-1 text-xs text-white/70">Admin Panel</p>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white/80 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={[
                    "group flex items-center gap-3 rounded-r-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-l-[3px] border-[#2563EB] bg-[rgba(59,130,246,0.2)] text-[#93C5FD]"
                      : "border-l-[3px] border-transparent text-[rgba(255,255,255,0.65)] hover:bg-[rgba(147,197,253,0.12)] hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <div className="rounded-2xl border border-white/10 bg-[rgba(11,22,48,0.72)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {toInitials(admin.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
                <p className="truncate text-xs text-white/55">{admin.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-[rgba(147,197,253,0.14)] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
