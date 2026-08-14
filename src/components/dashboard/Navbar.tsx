"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";

type NavbarProps = {
  userName: string;
  onMenuClick?: () => void;
};

function pageTitleFromPath(pathname: string) {
  if (pathname === "/dashboard") {
    return "Dashboard";
  }

  const parts = pathname.split("/").filter(Boolean);
  const last = parts.at(-1);

  if (!last) {
    return "Dashboard";
  }

  return last
    .split("-")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function toInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Navbar({ userName, onMenuClick }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[var(--border)] bg-white">
      <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-slate-600 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="truncate text-lg font-semibold text-[var(--foreground)]">{pageTitleFromPath(pathname)}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-slate-500 hover:text-[var(--primary)]"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-slate-500 hover:text-[var(--primary)]"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-2.5 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-[var(--primary)]">
              {toInitials(userName)}
            </div>
            <span className="hidden max-w-28 truncate text-sm font-medium text-[var(--foreground)] sm:inline">
              {userName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}