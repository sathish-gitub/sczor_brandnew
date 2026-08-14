import { TrendingDown, TrendingUp } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  trendPercent?: number;
  trendLabel?: string;
};

export function StatCard({ label, value, trendPercent, trendLabel }: StatCardProps) {
  const positive = (trendPercent ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>

      {trendPercent !== undefined ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
          {positive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          )}
          <span className={positive ? "text-emerald-600" : "text-red-600"}>{Math.abs(trendPercent)}%</span>
          <span className="text-[var(--muted)]">{trendLabel ?? "vs previous period"}</span>
        </p>
      ) : null}
    </div>
  );
}
