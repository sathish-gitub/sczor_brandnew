"use client";

import Link from "next/link";

type AppointmentViewTabsProps = {
  active: "list" | "calendar";
};

/** "List | Day View" tab switcher shown atop both /appointments and /appointments/calendar. */
export function AppointmentViewTabs({ active }: AppointmentViewTabsProps) {
  const tabClass = (isActive: boolean) =>
    [
      "inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition",
      isActive ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]",
    ].join(" ");

  return (
    <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
      <Link href="/appointments" className={tabClass(active === "list")}>
        List
      </Link>
      <Link href="/appointments/calendar" className={tabClass(active === "calendar")}>
        Day View
      </Link>
    </div>
  );
}
