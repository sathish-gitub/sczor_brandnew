"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarPlus,
  Clock3,
  CreditCard,
  IndianRupee,
  UserPlus,
  Users,
} from "lucide-react";

type DashboardStats = {
  todayAppointments: number;
  todayRevenue: number;
  newCustomers: number;
  staffPresent: number;
  totalStaff: number;
  range?: string;
};

type DashboardAppointment = {
  id: string;
  appointmentTime: string;
  status: "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BILLED";
  customer: {
    name: string;
  };
  service: {
    name: string;
  };
  staff: {
    name: string;
  };
};

type StaffAvailability = {
  id: string;
  name: string;
  designation: string;
  status: "ACTIVE" | "INACTIVE";
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  displayStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY" | "INACTIVE";
  todayAttendance: "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | null;
  todayAppointments: number;
  totalAppointments: number;
};

type DashboardRange = "today" | "week" | "month" | "year" | "custom";

const rangeLabel: Record<DashboardRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom",
};

const defaultStats: DashboardStats = {
  todayAppointments: 0,
  todayRevenue: 0,
  newCustomers: 0,
  staffPresent: 0,
  totalStaff: 0,
};

function toInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusChip(status: DashboardAppointment["status"]) {
  if (status === "IN_PROGRESS") {
    return {
      label: "In Progress",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  if (status === "COMPLETED" || status === "BILLED") {
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "Cancelled",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  return {
    label: "Booked",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  };
}

function staffStatus(status: "AVAILABLE" | "BUSY" | "OFF_DUTY" | "INACTIVE") {
  if (status === "INACTIVE") {
    return {
      label: "Inactive",
      dot: "bg-slate-400",
    };
  }

  if (status === "BUSY") {
    return {
      label: "Busy",
      dot: "bg-amber-500",
    };
  }

  if (status === "OFF_DUTY") {
    return {
      label: "Off Duty",
      dot: "bg-red-500",
    };
  }

  return {
    label: "Available",
    dot: "bg-emerald-500",
  };
}

function resolveStaffStatus(member: StaffAvailability): "AVAILABLE" | "BUSY" | "OFF_DUTY" | "INACTIVE" {
  if (member.status === "INACTIVE") {
    return "INACTIVE";
  }

  if (member.todayAttendance === "ABSENT" || member.todayAttendance === "LEAVE") {
    return "OFF_DUTY";
  }

  return member.availabilityStatus;
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[var(--border)] bg-white ${className}`}>{children}</section>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="h-80 animate-pulse rounded-xl border border-[var(--border)] bg-white xl:col-span-3" />
        <div className="h-80 animate-pulse rounded-xl border border-[var(--border)] bg-white xl:col-span-2" />
      </div>
      <div className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
    </div>
  );
}

export default function DashboardPage() {
  const [selectedRange, setSelectedRange] = useState<DashboardRange>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [staff, setStaff] = useState<StaffAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const [statsResponse, appointmentsResponse, staffResponse] = await Promise.all([
          fetch(
            `/api/dashboard/stats?${new URLSearchParams({
              range: selectedRange,
              ...(selectedRange === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : {}),
            }).toString()}`,
            { cache: "no-store" },
          ),
          fetch("/api/dashboard/today-appointments", { cache: "no-store" }),
          fetch("/api/dashboard/staff-availability", { cache: "no-store" }),
        ]);

        if (!statsResponse.ok || !appointmentsResponse.ok || !staffResponse.ok) {
          throw new Error("Unable to load dashboard data.");
        }

        const [statsData, appointmentsData, staffData] = await Promise.all([
          statsResponse.json() as Promise<DashboardStats>,
          appointmentsResponse.json() as Promise<DashboardAppointment[] | { appointments: DashboardAppointment[] }>,
          staffResponse.json() as Promise<StaffAvailability[] | { staff: StaffAvailability[] }>,
        ]);

        if (!active) {
          return;
        }

        setStats(statsData);
        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : appointmentsData.appointments ?? []);
        setStaff(Array.isArray(staffData) ? staffData : staffData.staff ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error(loadError);
        setError("We could not load your dashboard right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [selectedRange, customFrom, customTo]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetch(
        `/api/dashboard/stats?${new URLSearchParams({
          range: selectedRange,
          ...(selectedRange === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : {}),
        }).toString()}`,
        { cache: "no-store" },
      )
        .then((r) => r.json() as Promise<DashboardStats>)
        .then(setStats)
        .catch(() => null);
    }, 60_000);
    return () => clearInterval(interval);
  }, [selectedRange, customFrom, customTo]);

  useEffect(() => {
    function onFocus() {
      void fetch(
        `/api/dashboard/stats?${new URLSearchParams({
          range: selectedRange,
          ...(selectedRange === "custom" && customFrom && customTo ? { from: customFrom, to: customTo } : {}),
        }).toString()}`,
        { cache: "no-store" },
      )
        .then((r) => r.json() as Promise<DashboardStats>)
        .then(setStats)
        .catch(() => null);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedRange, customFrom, customTo]);

  const statCards = useMemo(
    () => [
      {
        icon: CalendarPlus,
        label: "Today's Appointments",
        value: stats.todayAppointments.toString(),
        trend: rangeLabel[selectedRange],
        trendTone: "text-emerald-600",
      },
      {
        icon: IndianRupee,
        label: "Revenue",
        value: formatCurrency(stats.todayRevenue),
        trend: rangeLabel[selectedRange],
        trendTone: "text-emerald-600",
      },
      {
        icon: UserPlus,
        label: "New Customers",
        value: stats.newCustomers.toString(),
        trend: rangeLabel[selectedRange],
        trendTone: "text-slate-500",
      },
      {
        icon: Users,
        label: "Staff Present",
        value: `${stats.staffPresent}/${stats.totalStaff}`,
        trend: rangeLabel[selectedRange],
        trendTone: "text-slate-500",
      },
    ],
    [stats, selectedRange],
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <SectionCard className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month", "year", "custom"] as DashboardRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setSelectedRange(range)}
              className={[
                "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold",
                selectedRange === range
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {rangeLabel[range]}
            </button>
          ))}

          {selectedRange === "custom" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-9 rounded-lg border border-[var(--border)] px-2 text-sm"
              />
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-9 rounded-lg border border-[var(--border)] px-2 text-sm"
              />
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <SectionCard key={card.label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[var(--muted)]">{card.label}</p>
                  <p className="mt-3 text-[28px] font-bold leading-none text-[var(--foreground)]">{card.value}</p>
                  <p className={`mt-3 text-xs font-medium ${card.trendTone}`}>{card.trend}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[var(--primary)]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <SectionCard className="xl:col-span-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Today&apos;s Appointments</h2>
            <Link href="/appointments" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
              View All
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 px-4 text-center">
              <Clock3 className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-[var(--foreground)]">No appointments scheduled for today.</p>
              <p className="text-sm text-[var(--muted)]">Create a new booking to get today&apos;s schedule started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="px-5 py-3 font-semibold">Time</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Service</th>
                    <th className="px-5 py-3 font-semibold">Staff</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => {
                    const chip = statusChip(appointment.status);

                    return (
                      <tr key={appointment.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-5 py-3 font-medium text-[var(--foreground)]">{appointment.appointmentTime}</td>
                        <td className="px-5 py-3 text-[var(--foreground)]">{appointment.customer.name}</td>
                        <td className="px-5 py-3 text-[var(--foreground)]">{appointment.service.name}</td>
                        <td className="px-5 py-3 text-[var(--foreground)]">{appointment.staff.name}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${chip.className}`}>
                            {chip.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard className="xl:col-span-2">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Staff Availability</h2>
          </div>

          <div className="p-4">
            {staff.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--muted)]">
                No active staff members found.
              </div>
            ) : (
              <>
                <div className="staff-scroll staff-scroll-container max-h-[320px] space-y-3 overflow-y-auto bg-transparent pr-1">
                  {staff.map((member) => {
                    const status = staffStatus(resolveStaffStatus(member));

                    return (
                      <div key={member.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-transparent px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-[var(--primary)]">
                            {toInitials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{member.name}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{member.designation}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                            <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {member.todayAppointments} today · {member.totalAppointments} total
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {staff.length > 5 ? <p className="mt-2 text-center text-xs text-[var(--muted)]">Scroll to see more</p> : null}
              </>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/appointments/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[var(--primary)] hover:bg-blue-100"
          >
            <CalendarPlus className="h-4 w-4" />
            New Appointment
          </Link>
          <Link
            href="/customers/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Link>
          <Link
            href="/billing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <CreditCard className="h-4 w-4" />
            Open POS
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <BarChart3 className="h-4 w-4" />
            View Reports
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}