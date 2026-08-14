"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Tier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type MemberRow = {
  customerId: string;
  customerName: string;
  mobile: string;
  tier: Tier;
  points: number;
  totalSpent: number;
  lastTransaction: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const tierMeta: Record<Tier, { label: string; range: string; color: string }> = {
  BRONZE: { label: "Bronze", range: "0-499", color: "#CD7F32" },
  SILVER: { label: "Silver", range: "500-1999", color: "#94A3B8" },
  GOLD: { label: "Gold", range: "2000-4999", color: "#EAB308" },
  PLATINUM: { label: "Platinum", range: "5000+", color: "#8B5CF6" },
};

export default function LoyaltyPage() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    pointsIssued: 0,
    pointsRedeemed: 0,
    activeMembers: 0,
    tiers: {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    },
  });

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<MemberRow | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(search.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      const response = await fetch("/api/loyalty/stats", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            totalMembers?: number;
            pointsIssued?: number;
            pointsRedeemed?: number;
            activeMembers?: number;
            tiers?: Record<Tier, number>;
          }
        | null;

      if (!active || !response.ok || !payload) {
        return;
      }

      setStats((current) => ({
        ...current,
        totalMembers: payload.totalMembers ?? 0,
        pointsIssued: payload.pointsIssued ?? 0,
        pointsRedeemed: payload.pointsRedeemed ?? 0,
        activeMembers: payload.activeMembers ?? 0,
        tiers: {
          BRONZE: payload.tiers?.BRONZE ?? 0,
          SILVER: payload.tiers?.SILVER ?? 0,
          GOLD: payload.tiers?.GOLD ?? 0,
          PLATINUM: payload.tiers?.PLATINUM ?? 0,
        },
      }));
    }

    loadStats();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: "1",
        limit: "50",
      });

      if (query) {
        params.set("search", query);
      }

      const response = await fetch(`/api/loyalty/members?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { error?: string; items?: MemberRow[] } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload) {
        setError(payload?.error ?? "Unable to load loyalty members.");
        setLoading(false);
        return;
      }

      setMembers(payload.items ?? []);
      setLoading(false);
    }

    loadMembers();

    return () => {
      active = false;
    };
  }, [query]);

  async function redeemPointsForMember() {
    if (!redeemTarget) {
      return;
    }

    const response = await fetch("/api/loyalty/redeem", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: redeemTarget.customerId,
        points: redeemPoints,
        reason: "Redeemed from loyalty dashboard",
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setToast(payload?.error ?? "Unable to redeem points.");
      return;
    }

    setMembers((current) =>
      current.map((item) =>
        item.customerId === redeemTarget.customerId
          ? {
              ...item,
              points: Math.max(0, item.points - redeemPoints),
            }
          : item,
      ),
    );

    setToast("Points redeemed successfully.");
    setRedeemOpen(false);
    setRedeemTarget(null);
    setRedeemPoints(0);
  }

  const tierCards = useMemo(() => ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const, []);

  return (
    <div className="space-y-5">
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{toast}</div>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Loyalty Program</h1>
        </div>

        <Link href="/loyalty/settings" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">
          <Settings className="h-4 w-4" />
          Program Settings
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Total Members</p><p className="mt-2 text-2xl font-bold">{stats.totalMembers}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Points Issued</p><p className="mt-2 text-2xl font-bold">{stats.pointsIssued}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Points Redeemed</p><p className="mt-2 text-2xl font-bold">{stats.pointsRedeemed}</p></div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4"><p className="text-xs text-[var(--muted)]">Active Members</p><p className="mt-2 text-2xl font-bold">{stats.activeMembers}</p></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tierCards.map((tier) => (
          <article key={tier} className="rounded-xl border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold" style={{ color: tierMeta[tier].color }}>{tierMeta[tier].label}</p>
            <p className="text-xs text-[var(--muted)]">{tierMeta[tier].range}</p>
            <p className="mt-3 text-2xl font-bold text-[var(--foreground)]">{stats.tiers[tier]}</p>
            <p className="text-xs text-[var(--muted)]">members</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by mobile or name"
          className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm"
        />
      </section>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center text-sm text-[var(--muted)]">
          No loyalty members found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Mobile</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Points</th>
                <th className="px-3 py-2">Total Spent</th>
                <th className="px-3 py-2">Last Transaction</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((row) => (
                <tr key={row.customerId} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-semibold">{row.customerName}</td>
                  <td className="px-3 py-2">{row.mobile}</td>
                  <td className="px-3 py-2">{row.tier}</td>
                  <td className="px-3 py-2">{row.points}</td>
                  <td className="px-3 py-2">{formatCurrency(row.totalSpent)}</td>
                  <td className="px-3 py-2">{formatDate(row.lastTransaction)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link href={`/loyalty/${row.customerId}`} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700">View Card</Link>
                      <button
                        type="button"
                        onClick={() => {
                          setRedeemTarget(row);
                          setRedeemOpen(true);
                          setRedeemPoints(Math.min(100, row.points));
                        }}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                      >
                        Redeem Points
                      </button>
                      <Link href={`/loyalty/${row.customerId}`} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700">History</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {redeemOpen && redeemTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Redeem Points</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{redeemTarget.customerName}</p>
            <p className="text-xs text-[var(--muted)]">Available: {redeemTarget.points} points</p>

            <label className="mt-4 block text-sm">
              <span className="text-[var(--muted)]">Points to redeem</span>
              <input
                type="number"
                min={1}
                max={redeemTarget.points}
                value={redeemPoints}
                onChange={(event) => setRedeemPoints(Math.min(redeemTarget.points, Number(event.target.value) || 0))}
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3"
              />
            </label>

            <p className="mt-2 text-sm text-[var(--muted)]">Equivalent: {formatCurrency(redeemPoints)}</p>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRedeemOpen(false)} className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={redeemPointsForMember} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">Confirm</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
