"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Mail, Phone, Star } from "lucide-react";

import { StaffAvatar } from "@/components/staff/StaffAvatar";

type StaffDetail = {
  id: string;
  name: string;
  designation: string;
  mobile: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  workingDays: string[];
  createdAt: string;
  stats: {
    totalAppointments: number;
    monthAppointments: number;
    attendancePercentage: number;
    avgRating: number;
    totalRatings: number;
  };
  scheduleWeek: Array<{
    id: string;
    appointmentDate: string;
    appointmentTime: string;
    customerName: string;
    serviceName: string;
    status: string;
  }>;
  attendanceMonth: Array<{
    id: string;
    date: string;
    status: string;
  }>;
  performance: {
    servicesByCategory: Record<string, number>;
    revenueGenerated: number;
    customerSatisfaction: string;
  };
};

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

export default function StaffProfilePage() {
  const params = useParams<{ id: string }>();

  const [tab, setTab] = useState<"profile" | "schedule" | "attendance" | "performance">("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSuccess, setRatingSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/staff/${params.id}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; staff?: StaffDetail };

      if (!response.ok || !payload.staff) {
        if (active) {
          setError(payload.error ?? "Unable to load staff profile.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      setStaff(payload.staff);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [params.id]);

  const tabs = useMemo(
    () => [
      { id: "profile", label: "Profile" },
      { id: "schedule", label: "Schedule" },
      { id: "attendance", label: "Attendance" },
      { id: "performance", label: "Performance" },
    ],
    [],
  );

  async function submitRating(stars: number) {
    if (ratingPending) return;
    setRatingPending(true);
    setRatingSuccess(false);

    const response = await fetch(`/api/staff/${params.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: stars, comment: ratingComment }),
    });

    const payload = (await response.json().catch(() => null)) as {
      avgRating?: number;
      totalRatings?: number;
      error?: string;
    } | null;

    setRatingPending(false);

    if (!response.ok || !payload) {
      setError(payload?.error ?? "Unable to save rating.");
      return;
    }

    setStaff((prev) =>
      prev
        ? {
            ...prev,
            stats: {
              ...prev.stats,
              avgRating: payload.avgRating ?? prev.stats.avgRating,
              totalRatings: payload.totalRatings ?? prev.stats.totalRatings,
            },
          }
        : prev,
    );
    setRatingComment("");
    setRatingSuccess(true);
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  if (!staff) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Profile not found."}</div>;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <StaffAvatar name={staff.name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{staff.name}</h1>
              <p className="text-sm text-[var(--muted)]">{staff.designation}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{staff.status}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{staff.availabilityStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/staff/${staff.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p className="inline-flex items-center gap-2 text-[var(--muted)]">
            <Phone className="h-4 w-4" />
            {staff.mobile || "No mobile"}
          </p>
          <p className="inline-flex items-center gap-2 text-[var(--muted)]">
            <Mail className="h-4 w-4" />
            {staff.email || "No email"}
          </p>
          <p className="inline-flex items-center gap-2 text-[var(--muted)]">
            <CalendarDays className="h-4 w-4" />
            Joined {formatDate(staff.createdAt)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total Appointments</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{staff.stats.totalAppointments}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">This Month</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{staff.stats.monthAppointments}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Attendance</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{staff.stats.attendancePercentage}%</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Avg Rating</p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{staff.stats.avgRating}</p>
          </div>
        </div>
      </header>

      <div className="inline-flex rounded-xl border border-[var(--border)] bg-white p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as typeof tab)}
            className={[
              "rounded-lg px-3 py-2 text-sm font-semibold",
              tab === item.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Profile Details</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">Working days</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {staff.workingDays.map((day) => (
              <span key={day} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {day}
              </span>
            ))}
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Rate this staff member</h3>
            {ratingSuccess ? (
              <p className="mt-2 text-sm text-emerald-600">Rating submitted — thank you!</p>
            ) : null}
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={ratingPending}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => submitRating(star)}
                  className="focus:outline-none disabled:opacity-50"
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={[
                      "h-7 w-7 transition-colors",
                      (ratingHover || 0) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300",
                    ].join(" ")}
                  />
                </button>
              ))}
            </div>
            <input
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Optional comment…"
              maxLength={500}
              className="mt-2 h-9 w-full max-w-sm rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Weekly Schedule</h2>
          {staff.scheduleWeek.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No appointments scheduled this week.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">Time</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Service</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.scheduleWeek.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="py-2">{formatDate(row.appointmentDate)}</td>
                      <td className="py-2">{row.appointmentTime}</td>
                      <td className="py-2">{row.customerName}</td>
                      <td className="py-2">{row.serviceName}</td>
                      <td className="py-2">{row.status.replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "attendance" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Monthly Attendance</h2>
          {staff.attendanceMonth.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No attendance records available this month.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staff.attendanceMonth.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[var(--border)] p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(entry.date)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{entry.status.replaceAll("_", " ")}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "performance" ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Performance</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Revenue Generated</p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{formatCurrency(staff.performance.revenueGenerated)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Customer Satisfaction</p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{staff.performance.customerSatisfaction}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Service Category Mix</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(staff.performance.servicesByCategory).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No service distribution data yet.</p>
              ) : (
                Object.entries(staff.performance.servicesByCategory).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-[var(--muted)]">{key}</span>
                    <span className="font-semibold text-[var(--foreground)]">{value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
