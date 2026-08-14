"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">Unable to load this page</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Please retry or go back to dashboard home.</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">
          <RefreshCcw className="h-4 w-4" />
          Retry
        </button>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
