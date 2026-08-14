"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, Pencil } from "lucide-react";

import { CustomerCard } from "@/components/customers/CustomerCard";
import { LoyaltyCard } from "@/components/customers/LoyaltyCard";
import { StatusBadge } from "@/components/appointments/StatusBadge";

type CustomerProfilePayload = {
  customer: {
    id: string;
    name: string;
    mobile: string;
    email?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
    dateOfBirth?: string | null;
    notes?: string | null;
    createdAt: string;
    loyaltyCard?: {
      tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
      totalPoints: number;
      totalSpent: number;
      transactions: Array<{
        id: string;
        createdAt: string;
        type: "EARNED" | "REDEEMED";
        points: number;
        description?: string | null;
      }>;
    } | null;
    appointments: Array<{
      id: string;
      appointmentDate: string;
      appointmentTime: string;
      status: "BOOKED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BILLED";
      service: { name: string };
      staff: { name: string };
      invoice?: { total: number } | null;
    }>;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      invoiceDate: string;
      total: number;
      paymentMethod: "CASH" | "UPI" | "CARD" | "WALLET";
      paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
    }>;
    totalVisits: number;
    totalSpent: number;
    loyaltyPoints: number;
  };
};

type TabKey = "appointments" | "invoices" | "notes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
      <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabKey>("appointments");
  const [profile, setProfile] = useState<CustomerProfilePayload["customer"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/customers/${params.id}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as { error?: string; customer?: CustomerProfilePayload["customer"] };

        if (!response.ok || !payload.customer) {
          throw new Error(payload.error ?? "Unable to load customer profile.");
        }

        if (!active) {
          return;
        }

        setProfile(payload.customer);
        setNotesDraft(payload.customer.notes ?? "");
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load customer profile.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [params.id]);

  const successMessage = useMemo(() => {
    const value = searchParams.get("success");

    if (value === "created") {
      return "Customer created successfully.";
    }

    if (value === "updated") {
      return "Customer updated successfully.";
    }

    return null;
  }, [searchParams]);

  async function saveNotes() {
    if (!profile) {
      return;
    }

    setSavingNotes(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${profile.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: notesDraft }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update notes.");
        return;
      }

      setProfile((existing) => (existing ? { ...existing, notes: notesDraft } : existing));
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to update notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
        <p className="text-base font-semibold text-[var(--foreground)]">Customer not found.</p>
        <Link
          href="/customers"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  const loyaltyTier = profile.loyaltyCard?.tier ?? "BRONZE";

  return (
    <div className="space-y-5">
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <header className="rounded-xl border border-[var(--border)] bg-white px-5 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{profile.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Customer profile, appointments, invoices, and loyalty history.</p>
      </header>

      <CustomerCard
        id={profile.id}
        name={profile.name}
        mobile={profile.mobile}
        email={profile.email}
        createdAt={profile.createdAt}
        onEditHref={`/customers/${profile.id}/edit`}
        onAppointmentHref={`/appointments/new?customerId=${profile.id}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Visits" value={profile.totalVisits} />
        <StatCard label="Total Spent" value={formatCurrency(profile.totalSpent)} />
        <StatCard label="Loyalty Points" value={profile.loyaltyPoints} />
        <StatCard label="Loyalty Tier" value={loyaltyTier} />
      </div>

      <LoyaltyCard
        tier={loyaltyTier}
        totalPoints={profile.loyaltyCard?.totalPoints ?? 0}
        transactions={(profile.loyaltyCard?.transactions ?? []).map((txn) => ({
          ...txn,
          createdAt: txn.createdAt,
        }))}
      />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={[
              "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold",
              activeTab === "appointments" ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-[var(--foreground)]",
            ].join(" ")}
          >
            Appointment History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={[
              "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold",
              activeTab === "invoices" ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-[var(--foreground)]",
            ].join(" ")}
          >
            Invoice History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={[
              "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold",
              activeTab === "notes" ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-[var(--foreground)]",
            ].join(" ")}
          >
            Notes
          </button>
        </div>

        {activeTab === "appointments" ? (
          profile.appointments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--muted)]">
              No appointment history found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.appointments.map((appointment) => (
                    <tr key={appointment.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 text-[var(--foreground)]">
                        {formatDate(appointment.appointmentDate)} {appointment.appointmentTime}
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{appointment.service.name}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{appointment.staff.name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{formatCurrency(Number(appointment.invoice?.total ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {activeTab === "invoices" ? (
          profile.invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--muted)]">
              No invoices generated yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Invoice#</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{invoice.invoiceNumber}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{formatCurrency(Number(invoice.total))}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{invoice.paymentMethod}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{invoice.paymentStatus}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/invoices?invoiceId=${invoice.id}`}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-2 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {activeTab === "notes" ? (
          <div className="space-y-3">
            <textarea
              rows={6}
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Add customer preferences, allergies, and styling notes..."
            />
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={saveNotes}
                disabled={savingNotes}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Pencil className="h-4 w-4" />
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Link
          href={`/appointments/new?customerId=${profile.id}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
        >
          <Calendar className="h-4 w-4" />
          New Appointment
        </Link>
      </div>
    </div>
  );
}
