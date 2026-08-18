type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type LoyaltyTransaction = {
  id: string;
  createdAt: string;
  type: "EARNED" | "REDEEMED";
  points: number;
  description?: string | null;
};

type LoyaltyThresholds = {
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
};

type LoyaltyCardProps = {
  tier: LoyaltyTier;
  totalPoints: number;
  rupeePerPoint?: number;
  thresholds?: LoyaltyThresholds;
  transactions: LoyaltyTransaction[];
};

const tierPalette: Record<LoyaltyTier, { bg: string; text: string; accent: string }> = {
  BRONZE: {
    bg: "bg-[#CD7F32]/10",
    text: "text-[#CD7F32]",
    accent: "from-[#CD7F32] to-amber-500",
  },
  SILVER: {
    bg: "bg-[#94A3B8]/12",
    text: "text-[#94A3B8]",
    accent: "from-[#94A3B8] to-slate-300",
  },
  GOLD: {
    bg: "bg-[#EAB308]/15",
    text: "text-[#B45309]",
    accent: "from-[#EAB308] to-yellow-400",
  },
  PLATINUM: {
    bg: "bg-[#8B5CF6]/12",
    text: "text-[#8B5CF6]",
    accent: "from-[#8B5CF6] to-violet-400",
  },
};

function nextTierTarget(points: number, thresholds: LoyaltyThresholds) {
  const { silverThreshold, goldThreshold, platinumThreshold } = thresholds;

  if (points < silverThreshold) {
    return { currentFloor: 0, target: silverThreshold, nextTier: "SILVER" };
  }

  if (points < goldThreshold) {
    return { currentFloor: silverThreshold, target: goldThreshold, nextTier: "GOLD" };
  }

  if (points < platinumThreshold) {
    return { currentFloor: goldThreshold, target: platinumThreshold, nextTier: "PLATINUM" };
  }

  return { currentFloor: platinumThreshold, target: platinumThreshold, nextTier: "PLATINUM" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function LoyaltyCard({
  tier,
  totalPoints,
  rupeePerPoint = 1,
  thresholds = { silverThreshold: 500, goldThreshold: 2000, platinumThreshold: 5000 },
  transactions,
}: LoyaltyCardProps) {
  const palette = tierPalette[tier];
  const target = nextTierTarget(totalPoints, thresholds);
  const progressBase = target.target - target.currentFloor;
  const progressValue = Math.max(0, totalPoints - target.currentFloor);
  const progress = target.target === target.currentFloor ? 100 : Math.min(100, (progressValue / progressBase) * 100);
  const worthValue = totalPoints * rupeePerPoint;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="rounded-2xl border border-transparent bg-[linear-gradient(120deg,rgba(13,27,62,0.96),rgba(30,64,175,0.85))] p-5 text-white shadow-[0_18px_50px_rgba(30,64,175,0.25)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-white/80">Loyalty Tier</p>
            <p className="mt-2 text-2xl font-semibold tracking-wide">{tier}</p>
          </div>

          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette.bg} ${palette.text}`}>
            {tier}
          </span>
        </div>

        <p className="mt-5 text-4xl font-bold leading-none">{totalPoints}</p>
        <p className="mt-1 text-sm text-white/80">Points balance</p>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className={`h-full bg-gradient-to-r ${palette.accent}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/80">
            <span>
              {target.target === target.currentFloor
                ? "Top tier reached"
                : `${target.target - totalPoints} points to ${target.nextTier}`}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-white/85">Worth Rs. {worthValue.toFixed(0)}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Transaction History</h3>

        {transactions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm text-[var(--muted)]">
            No loyalty transactions yet.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-[var(--foreground)]">{formatDate(transaction.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          transaction.type === "EARNED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{transaction.points}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{transaction.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
