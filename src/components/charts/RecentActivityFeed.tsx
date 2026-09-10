"use client";

import { CheckCircle2, CreditCard, Star, UserPlus } from "lucide-react";

export type ActivityItem = {
  type: "signup" | "subscription" | "payment" | "activation";
  tenantName: string;
  timestamp: string;
  detail: string;
};

const ACTIVITY_ICONS: Record<ActivityItem["type"], typeof UserPlus> = {
  signup: UserPlus,
  subscription: Star,
  payment: CreditCard,
  activation: CheckCircle2,
};

const ACTIVITY_COLORS: Record<ActivityItem["type"], string> = {
  signup: "bg-blue-100 text-blue-700",
  subscription: "bg-purple-100 text-purple-700",
  payment: "bg-emerald-100 text-emerald-700",
  activation: "bg-amber-100 text-amber-700",
};

function timeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

export function RecentActivityFeed({ data, loading }: { data: ActivityItem[]; loading: boolean }) {
  const empty = data.length === 0;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--foreground)]">Recent Activity</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Latest signups and payments across all salons</p>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="animate-pulse rounded-lg bg-slate-100" style={{ height: 280 }} />
        ) : empty ? (
          <div
            className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-center"
            style={{ height: 280 }}
          >
            <p className="text-sm font-medium text-[var(--foreground)]">No data yet</p>
            <p className="text-xs text-[var(--muted)]">No recent activity to show.</p>
          </div>
        ) : (
          <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {data.map((item, index) => {
              const Icon = ACTIVITY_ICONS[item.type];

              return (
                <div
                  key={`${item.type}-${item.tenantName}-${item.timestamp}-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-3"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ACTIVITY_COLORS[item.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.tenantName}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{item.detail}</p>
                  </div>
                  <p className="shrink-0 text-xs text-[var(--muted)]">{timeAgo(item.timestamp)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
