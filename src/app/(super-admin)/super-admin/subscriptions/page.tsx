"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";

type SubscriptionRow = {
  id: string;
  salon: string;
  owner: string;
  ownerEmail: string;
  amount: number;
  start: string | null;
  end: string | null;
  status: string;
};

type SubscriptionsResponse = {
  summary: {
    monthlyCount: number;
    monthlyPrice: number;
    monthlyMRR: number;
    yearlyCount: number;
    yearlyPrice: number;
    yearlyRevenue: number;
    totalMRR: number;
  };
  monthly: SubscriptionRow[];
  yearly: SubscriptionRow[];
  recentPayments: Array<{
    id: string;
    salon: string;
    plan: string;
    amount: number;
    date: string;
    status: string;
    invoiceNumber: string | null;
    baseAmount: number | null;
    gstAmount: number | null;
    gstRate: number | null;
    invoiceEmailSentAt: string | null;
  }>;
};

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [invoicePayment, setInvoicePayment] = useState<SubscriptionsResponse["recentPayments"][number] | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/super-admin/subscriptions", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.summary) {
          throw new Error(payload?.error ?? "Failed to load subscriptions");
        }
        setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subscriptions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--muted)]">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-[var(--muted)]">No data available.</div>;
  }

  const rows = tab === "MONTHLY" ? data.monthly : data.yearly;

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Monthly</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {data?.summary?.monthlyCount ?? 0} salons × {formatCurrency(data?.summary?.monthlyPrice ?? 0)} = {formatCurrency(data?.summary?.monthlyMRR ?? 0)}/month
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Yearly</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {data?.summary?.yearlyCount ?? 0} salons × {formatCurrency(data?.summary?.yearlyPrice ?? 0)} = {formatCurrency(data?.summary?.yearlyRevenue ?? 0)}/year
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total MRR</p>
          <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{formatCurrency(data?.summary?.totalMRR ?? 0)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["MONTHLY", "YEARLY"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold",
              tab === item ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200",
            ].join(" ")}
          >
            {item.charAt(0) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-4 py-3">Salon</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">{tab === "MONTHLY" ? "Next Renewal" : "Expires"}</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--muted)]">
                  No {tab.toLowerCase()} subscriptions yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{row.salon}</td>
                  <td className="px-4 py-3">
                    {row.owner}
                    <div className="text-xs text-[var(--muted)]">{row.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.start)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.end)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-bold text-[var(--foreground)]">Recent Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-4 py-3">Salon</th>
                <th className="px-4 py-3">Invoice No.</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--muted)]">
                    No payments yet.
                  </td>
                </tr>
              ) : (
                data.recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{payment.salon}</td>
                    <td className="px-4 py-3">{payment.invoiceNumber ?? "-"}</td>
                    <td className="px-4 py-3">{payment.plan}</td>
                    <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          payment.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-700"
                            : payment.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payment.invoiceNumber ? (
                        <button
                          type="button"
                          onClick={() => setInvoicePayment(payment)}
                          className="text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          View Invoice
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {invoicePayment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setInvoicePayment(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[var(--foreground)]">Invoice {invoicePayment.invoiceNumber}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{invoicePayment.salon}</p>

            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Subscription Amount</span>
                <span>₹{(invoicePayment.baseAmount ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">CGST ({(invoicePayment.gstRate ?? 18) / 2}%)</span>
                <span>₹{((invoicePayment.gstAmount ?? 0) / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">SGST ({(invoicePayment.gstRate ?? 18) / 2}%)</span>
                <span>₹{((invoicePayment.gstAmount ?? 0) / 2).toFixed(2)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-1.5 font-semibold">
                <span>Total Paid</span>
                <span>₹{invoicePayment.amount.toFixed(2)}</span>
              </div>
            </div>

            <p className="mt-4 text-xs text-[var(--muted)]">
              Invoice email {invoicePayment.invoiceEmailSentAt ? "sent" : "not sent"}
              {invoicePayment.invoiceEmailSentAt ? ` on ${formatDate(invoicePayment.invoiceEmailSentAt)}` : ""}
            </p>

            <button
              type="button"
              onClick={() => setInvoicePayment(null)}
              className="mt-5 w-full rounded-xl border border-[var(--border)] py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
