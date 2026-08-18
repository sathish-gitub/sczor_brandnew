"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NavbarProps = {
  userName: string;
  onMenuClick?: () => void;
};

type SearchHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

type SearchResults = {
  customers: SearchHit[];
  appointments: SearchHit[];
  invoices: SearchHit[];
};

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  href: string;
  createdAt: string;
};

const emptyResults: SearchResults = { customers: [], appointments: [], invoices: [] };

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults(emptyResults);
      return;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setSearching(true);

      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as SearchResults | null;

      if (!active) {
        return;
      }

      setResults(response.ok && payload ? payload : emptyResults);
      setSearching(false);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, searchOpen]);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { items?: NotificationItem[] } | null;

      if (!active || !response.ok) {
        return;
      }

      setNotifications(payload?.items ?? []);
    }

    loadNotifications();

    return () => {
      active = false;
    };
  }, [pathname]);

  const groups = useMemo(
    () => [
      { label: "Customers", items: results.customers },
      { label: "Appointments", items: results.appointments },
      { label: "Invoices", items: results.invoices },
    ],
    [results],
  );

  const hasResults = groups.some((group) => group.items.length > 0);

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
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                setNotificationsOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-slate-500 hover:text-[var(--primary)]"
              aria-label="Search"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            {searchOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-[min(92vw,26rem)] rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg">
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search customers, appointments, invoices"
                  className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                />

                <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
                  {query.trim().length < 2 ? (
                    <p className="text-sm text-[var(--muted)]">Type at least 2 characters.</p>
                  ) : searching ? (
                    <p className="text-sm text-[var(--muted)]">Searching...</p>
                  ) : !hasResults ? (
                    <p className="text-sm text-[var(--muted)]">No matches found.</p>
                  ) : (
                    groups
                      .filter((group) => group.items.length > 0)
                      .map((group) => (
                        <div key={group.label}>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {group.label}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {group.items.map((item) => (
                              <li key={item.id}>
                                <Link
                                  href={item.href}
                                  onClick={() => setSearchOpen(false)}
                                  className="block rounded-lg px-2 py-1.5 hover:bg-slate-50"
                                >
                                  <span className="block text-sm font-medium text-[var(--foreground)]">{item.title}</span>
                                  <span className="block text-xs text-[var(--muted)]">{item.subtitle}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setSearchOpen(false);
              }}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-slate-500 hover:text-[var(--primary)]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-white">
                  {notifications.length}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 z-40 mt-2 w-[min(92vw,22rem)] rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg">
                <p className="text-sm font-semibold text-[var(--foreground)]">Recent activity</p>

                {notifications.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">Nothing new today.</p>
                ) : (
                  <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => setNotificationsOpen(false)}
                          className="block rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)] hover:bg-slate-50"
                        >
                          {item.message}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
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