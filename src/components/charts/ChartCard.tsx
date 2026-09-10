"use client";

import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  loading: boolean;
  empty: boolean;
  emptyMessage?: string;
  height?: number;
  children: ReactNode;
  className?: string;
};

export function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage = "No data yet",
  height = 280,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5 ${className}`}>
      <div>
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse rounded-lg bg-slate-100" style={{ height }} />
        ) : empty ? (
          <div
            className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-center"
            style={{ height }}
          >
            <p className="text-sm font-medium text-[var(--foreground)]">No data yet</p>
            <p className="text-xs text-[var(--muted)]">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
