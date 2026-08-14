"use client";

import Link from "next/link";
import { RefreshCcw, ShieldAlert } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-[var(--foreground)]">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">An unexpected error occurred. You can retry this screen or return to your dashboard.</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">
            Back to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
