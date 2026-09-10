"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/reports/StatCard";
import { RecentActivityFeed, type ActivityItem } from "@/components/charts/RecentActivityFeed";
import { RevenueOverviewChart, type RevenueOverviewPoint } from "@/components/charts/RevenueOverviewChart";
import { SalonGrowthChart, type SalonGrowthPoint } from "@/components/charts/SalonGrowthChart";
import { SalonStatusDonut, type SalonStatusPoint } from "@/components/charts/SalonStatusDonut";
import { SubscriptionDistributionDonut, type SubscriptionDistributionPoint } from "@/components/charts/SubscriptionDistributionDonut";
import { TopSalonsBarChart, type TopSalonPoint } from "@/components/charts/TopSalonsBarChart";

type DashboardStats = {
  stats: {
    totalSalons: number;
    activeSalons: number;
    trialSalons: number;
    monthlySubscribers: number;
    yearlySubscribers: number;
    monthlyRevenue: number;
  };
  revenue: {
    monthlyRecurring: number;
    yearlyThisMonth: number;
    totalMRR: number;
    totalRevenue: number;
    monthRevenue: number;
    failedPayments: number;
  };
  monthlySignups: Array<{ month: string; count: number }>;
  subscriptionBreakdown: Array<{ label: string; key: string; count: number; percent: number }>;
  recentSalons: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    isActive: boolean;
  }>;
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  TRIAL: "bg-blue-100 text-blue-700",
  MONTHLY: "bg-emerald-100 text-emerald-700",
  YEARLY: "bg-emerald-900/10 text-emerald-900",
  EXPIRED: "bg-orange-100 text-orange-700",
  INACTIVE: "bg-slate-100 text-slate-600",
};

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

type ChartsData = {
  salonGrowth: SalonGrowthPoint[];
  subscriptionDistribution: SubscriptionDistributionPoint[];
  revenueOverview: RevenueOverviewPoint[];
  salonStatus: SalonStatusPoint[];
  topSalons: TopSalonPoint[];
  recentActivity: ActivityItem[];
};

const defaultChartsData: ChartsData = {
  salonGrowth: [],
  subscriptionDistribution: [],
  revenueOverview: [],
  salonStatus: [],
  topSalons: [],
  recentActivity: [],
};

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartsData, setChartsData] = useState<ChartsData>(defaultChartsData);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/super-admin/dashboard/stats", { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load dashboard");
        }

        if (active) {
          setData(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCharts() {
      setChartsLoading(true);

      try {
        const response = await fetch("/api/super-admin/dashboard/charts", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load chart data");
        }

        const payload = (await response.json()) as ChartsData;

        if (active) {
          setChartsData(payload);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setChartsLoading(false);
        }
      }
    }

    loadCharts();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--muted)]">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Salons" value={data.stats.totalSalons} />
        <StatCard label="Active Salons" value={data.stats.activeSalons} />
        <StatCard label="Trial Salons" value={data.stats.trialSalons} />
        <StatCard label="Monthly Subscribers" value={data.stats.monthlySubscribers} />
        <StatCard label="Yearly Subscribers" value={data.stats.yearlySubscribers} />
        <StatCard label="Monthly Revenue" value={formatCurrency(data.stats.monthlyRevenue)} />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          💰 Revenue Overview
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Monthly recurring</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(data.revenue.monthlyRecurring)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Yearly (this month)</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(data.revenue.yearlyThisMonth)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total MRR</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(data.revenue.totalMRR)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total Revenue</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(data.revenue.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">This Month&apos;s Revenue</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(data.revenue.monthRevenue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Failed Payments</p>
            <p className="mt-1 text-xl font-bold text-red-600">{data.revenue.failedPayments}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Analytics</h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SalonGrowthChart data={chartsData.salonGrowth} loading={chartsLoading} />
          <SubscriptionDistributionDonut data={chartsData.subscriptionDistribution} loading={chartsLoading} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RevenueOverviewChart data={chartsData.revenueOverview} loading={chartsLoading} />
          <SalonStatusDonut data={chartsData.salonStatus} loading={chartsLoading} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TopSalonsBarChart data={chartsData.topSalons} loading={chartsLoading} />
          <RecentActivityFeed data={chartsData.recentActivity} loading={chartsLoading} />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Recent Salons</h3>
          <Link href="/super-admin/salons" className="text-sm font-medium text-[var(--accent)]">
            View all →
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Joined</th>
                <th className="pb-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSalons.map((salon) => (
                <tr key={salon.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">{salon.name}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[salon.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {salon.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--muted)]">
                    {new Date(salon.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${salon.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {salon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {data.recentSalons.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--muted)]">
                    No salons yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
