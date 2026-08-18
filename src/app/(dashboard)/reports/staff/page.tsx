"use client";

import { useEffect, useState } from "react";

import { DataTable } from "@/components/reports/DataTable";
import { DateRangePicker } from "@/components/reports/DateRangePicker";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return { startDate: toDateString(start), endDate: toDateString(now) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

type Row = {
  staffId: string;
  name: string;
  designation: string;
  appointments: number;
  revenue: number;
  invoices: number;
  avgInvoice: number;
  attendancePercent: number;
  presentDays: number;
  absentDays: number;
  topServices: string[];
};

export default function StaffReportPage() {
  const [range, setRange] = useState(monthRange());
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    async function loadStaffOptions() {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { items?: Array<{ id: string; name: string }> } | null;
      if (active) {
        setStaffOptions(data?.items ?? []);
      }
    }
    loadStaffOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      });

      if (staffFilter !== "ALL") {
        params.set("staffId", staffFilter);
      }

      const response = await fetch(`/api/reports/staff?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { error?: string; items?: Row[] } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload) {
        setError(payload?.error ?? "Unable to load staff report.");
        setLoading(false);
        return;
      }

      setItems(payload.items ?? []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [range.startDate, range.endDate, staffFilter]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Staff Performance Report</h1>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <DateRangePicker value={range} onChange={setRange} />
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
            <option value="ALL">All Staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : (
        <>
          <DataTable
            columns={[
              { key: "name", label: "Staff", sortable: true, render: (row) => row.name, sortValue: (row) => row.name },
              { key: "appointments", label: "Appointments", sortable: true, render: (row) => row.appointments, sortValue: (row) => row.appointments },
              { key: "revenue", label: "Revenue", sortable: true, render: (row) => formatCurrency(row.revenue), sortValue: (row) => row.revenue },
              { key: "invoices", label: "Invoices", sortable: true, render: (row) => row.invoices, sortValue: (row) => row.invoices },
              { key: "avgInvoice", label: "Avg Invoice", sortable: true, render: (row) => formatCurrency(row.avgInvoice), sortValue: (row) => row.avgInvoice },
              { key: "attendance", label: "Attendance %", sortable: true, render: (row) => `${row.attendancePercent}%`, sortValue: (row) => row.attendancePercent },
              { key: "present", label: "Present", sortable: true, render: (row) => row.presentDays, sortValue: (row) => row.presentDays },
              { key: "absent", label: "Absent", sortable: true, render: (row) => row.absentDays, sortValue: (row) => row.absentDays },
            ]}
            rows={items}
            csvFileName="staff-performance.csv"
            emptyText="No staff performance data found."
          />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => (
              <article key={row.staffId} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                <p className="text-xs text-[var(--muted)]">{row.designation}</p>
                <p className="mt-2 text-sm">Appointments: <span className="font-semibold">{row.appointments}</span></p>
                <p className="text-sm">Revenue: <span className="font-semibold">{formatCurrency(row.revenue)}</span></p>
                <p className="text-sm">Top Services: <span className="font-semibold">{row.topServices.join(", ") || "-"}</span></p>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${row.attendancePercent}%` }} />
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
