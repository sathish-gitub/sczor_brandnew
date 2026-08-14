"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ComponentType } from "react";
import {
  BarChart3,
  CalendarCheck,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Scissors,
  Settings,
  Star,
  UserCog,
  Users,
  X,
} from "lucide-react";

type SidebarProps = {
  tenantName: string;
  user: {
    name: string;
    role: "OWNER" | "MANAGER" | "STAFF";
  };
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

type SidebarSection = {
  heading?: string;
  items: Array<{
    href: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }>;
};

const sections: SidebarSection[] = [
  {
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    heading: "MAIN MENU",
    items: [
      {
        href: "/appointments",
        label: "Appointments",
        icon: CalendarCheck,
      },
      {
        href: "/customers",
        label: "Customers",
        icon: Users,
      },
      {
        href: "/services",
        label: "Services",
        icon: Scissors,
      },
      {
        href: "/staff",
        label: "Staff",
        icon: UserCog,
      },
    ],
  },
  {
    heading: "BILLING",
    items: [
      {
        href: "/billing",
        label: "Billing / POS",
        icon: CreditCard,
      },
      {
        href: "/billing/invoices",
        label: "Invoices",
        icon: FileText,
      },
    ],
  },
  {
    heading: "OPERATIONS",
    items: [
      {
        href: "/attendance",
        label: "Attendance",
        icon: Clock,
      },
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
      },
    ],
  },
  {
    heading: "LOYALTY",
    items: [
      {
        href: "/loyalty",
        label: "Loyalty",
        icon: Star,
      },
    ],
  },
];

function toInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toTitleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ tenantName, user, mobileOpen, onCloseMobile }: SidebarProps) {
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
            <Image
              src="/images/sczor_logo_light.png"
              alt="sczor"
              width={96}
              height={32}
              priority
            />
            <p className="mt-1 text-xs text-white/70">{tenantName}</p>
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

      <div className="sidebar-nav flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIndex) => (
          <div key={section.heading ?? `section-${sectionIndex}`} className="mb-5 border-b border-white/10 pb-5 last:border-b-0 last:pb-0">
            {section.heading ? (
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.18em] text-white/40">{section.heading}</p>
            ) : null}
            <nav className="space-y-1.5">
              {section.items.map((item) => {
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
        ))}
      </div>

      <div className="mt-auto border-t border-white/10 px-4 py-4">
        <Link
          href="/settings"
          onClick={onCloseMobile}
          className={[
            "mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActiveRoute(pathname, "/settings")
              ? "border-l-[3px] border-[#2563EB] bg-[rgba(59,130,246,0.2)] text-[#93C5FD]"
              : "border-l-[3px] border-transparent text-[rgba(255,255,255,0.65)] hover:bg-[rgba(147,197,253,0.12)] hover:text-white",
          ].join(" ")}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[rgba(11,22,48,0.72)] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {toInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-white/55">{toTitleCase(user.role)}</p>
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