"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CardData = {
  customerId: string;
  name: string;
  mobile: string;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  points: number;
  totalSpent: number;
  memberSince: string;
  totalEarned: number;
  totalRedeemed: number;
  nextTierTarget: number;
  nextTierGap: number;
  progressPercent: number;
};

type HistoryRow = {
  id: string;
  date: string;
  type: "EARNED" | "REDEEMED";
  points: number;
  description: string | null;
  invoiceNumber: string | null;
  balanceAfter: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function LoyaltyCustomerPage() {
  const params = useParams<{ customerId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [openAdjust, setOpenAdjust] = useState(false);
  const [mode, setMode] = useState<"ADD" | "DEDUCT">("ADD");
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/loyalty/${params.customerId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; card?: CardData; history?: HistoryRow[] }
        | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.card) {
        setError(payload?.error ?? "Unable to load loyalty card.");
        setLoading(false);
        return;
      }

      setCard(payload.card);
      setHistory(payload.history ?? []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [params.customerId]);

  async function adjustPoints() {
    if (!card) {
      return;
    }

    const response = await fetch("/api/loyalty/adjust", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: card.customerId,
        mode,
        points,
        reason,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; totalPoints?: number } | null;

    if (!response.ok || payload?.totalPoints === undefined) {
      setError(payload?.error ?? "Unable to adjust points.");
      return;
    }

    setCard((current) => (current ? { ...current, points: payload.totalPoints! } : current));
    setOpenAdjust(false);
    setPoints(0);
    setReason("");

    const refresh = await fetch(`/api/loyalty/${params.customerId}`, { cache: "no-store" });
    const refreshed = (await refresh.json().catch(() => null)) as { card?: CardData; history?: HistoryRow[] } | null;
    if (refresh.ok && refreshed?.card) {
      setCard(refreshed.card);
      setHistory(refreshed.history ?? []);
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  if (!card) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Loyalty card not found."}</div>;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#312e81] p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-white/70">SCZOR Loyalty</p>
            <p className="mt-2 text-xl font-bold">{card.name}</p>
            <p className="text-sm text-white/80">+91 {card.mobile}</p>
          </div>
          <p className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{card.tier}</p>
        </div>
        <p className="mt-6 text-3xl font-bold">{card.points} Points</p>
        <p className="text-sm text-white/80">Worth {formatCurrency(card.points)}</p>
        <p className="mt-4 text-xs text-white/70">Member since {formatDate(card.memberSince)}</p>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--foreground)]">Progress to next tier</p>
          <p className="text-xs text-[var(--muted)]">{card.progressPercent}%</p>
        </div>
        <div className="mt-2 h-3 rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500" style={{ width: `${card.progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{card.nextTierGap} more points to next tier ({card.nextTierTarget})</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Total Earned</p><p className="mt-1 text-xl font-bold">{card.totalEarned}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Total Redeemed</p><p className="mt-1 text-xl font-bold">{card.totalRedeemed}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Total Spent</p><p className="mt-1 text-xl font-bold">{formatCurrency(card.totalSpent)}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Member Since</p><p className="mt-1 text-xl font-bold">{formatDate(card.memberSince)}</p></div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Transaction History</h2>
          <button
            type="button"
            onClick={() => setOpenAdjust(true)}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700"
          >
            Manual Adjust
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Type</th>
                <th className="py-2">Points</th>
                <th className="py-2">Description</th>
                <th className="py-2">Invoice#</th>
                <th className="py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{formatDate(row.date)}</td>
                  <td className="py-2">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      row.type === "EARNED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                    ].join(" ")}>{row.type}</span>
                  </td>
                  <td className="py-2">{row.points}</td>
                  <td className="py-2">{row.description || "-"}</td>
                  <td className="py-2">{row.invoiceNumber || "-"}</td>
                  <td className="py-2">{row.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openAdjust ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="text-lg font-semibold">Manual Adjustment</h3>
            <div className="mt-3 inline-flex rounded-lg border border-[var(--border)] p-1">
              <button type="button" onClick={() => setMode("ADD")} className={["rounded px-3 py-1 text-xs font-semibold", mode === "ADD" ? "bg-slate-900 text-white" : "text-slate-700"].join(" ")}>Add</button>
              <button type="button" onClick={() => setMode("DEDUCT")} className={["rounded px-3 py-1 text-xs font-semibold", mode === "DEDUCT" ? "bg-slate-900 text-white" : "text-slate-700"].join(" ")}>Deduct</button>
            </div>
            <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value) || 0)} className="mt-3 h-10 w-full rounded-xl border border-[var(--border)] px-3" placeholder="Points" />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2" rows={3} placeholder="Reason" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpenAdjust(false)} className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={adjustPoints} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
