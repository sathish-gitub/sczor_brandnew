"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const designations = [
  "Beautician",
  "Hair Stylist",
  "Nail Artist",
  "Makeup Artist",
  "Spa Therapist",
  "Receptionist",
  "Manager",
] as const;

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type StaffPayload = {
  id: string;
  name: string;
  designation: string;
  mobile: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  workingDays: string[];
  baseSalary: number | null;
  commissionRate: number | null;
  paidLeavesPerMonth: number | null;
};

export default function EditStaffPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);

  function validateMobile(value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (value.length > 0 && cleaned.length !== 10) {
      return "Mobile number must be exactly 10 digits.";
    }
    return null;
  }

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState<(typeof designations)[number]>("Beautician");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [availabilityStatus, setAvailabilityStatus] = useState<"AVAILABLE" | "BUSY" | "OFF_DUTY">("AVAILABLE");
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [baseSalary, setBaseSalary] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [paidLeavesPerMonth, setPaidLeavesPerMonth] = useState("");
  const [defaultPaidLeavesPerMonth, setDefaultPaidLeavesPerMonth] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [response, settingsResponse] = await Promise.all([
        fetch(`/api/staff/${params.id}`, { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const payload = (await response.json()) as { error?: string; staff?: StaffPayload };
      const settingsPayload = (await settingsResponse.json().catch(() => null)) as {
        payroll?: { defaultPaidLeavesPerMonth: number };
      } | null;

      if (!response.ok || !payload.staff) {
        if (active) {
          setError(payload.error ?? "Unable to load staff details.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      if (settingsPayload?.payroll) {
        setDefaultPaidLeavesPerMonth(settingsPayload.payroll.defaultPaidLeavesPerMonth);
      }

      setName(payload.staff.name);
      setDesignation(payload.staff.designation as (typeof designations)[number]);
      setMobile(payload.staff.mobile || "");
      setEmail(payload.staff.email || "");
      setStatus(payload.staff.status);
      setAvailabilityStatus(payload.staff.availabilityStatus);
      setWorkingDays(payload.staff.workingDays);
      setBaseSalary(payload.staff.baseSalary === null ? "" : String(payload.staff.baseSalary));
      setCommissionRate(payload.staff.commissionRate === null ? "" : String(payload.staff.commissionRate));
      setPaidLeavesPerMonth(payload.staff.paidLeavesPerMonth === null ? "" : String(payload.staff.paidLeavesPerMonth));
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [params.id]);

  function toggleWorkingDay(day: string) {
    setWorkingDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day);
      }

      return [...current, day];
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const mobileErr = mobile ? validateMobile(mobile) : null;
    if (mobileErr) {
      setMobileError(mobileErr);
      setSubmitting(false);
      return;
    }

    const response = await fetch(`/api/staff/${params.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        designation,
        mobile,
        email,
        status,
        availabilityStatus,
        workingDays,
        baseSalary: baseSalary.trim() === "" ? null : Number(baseSalary),
        commissionRate: commissionRate.trim() === "" ? null : Number(commissionRate),
        paidLeavesPerMonth: paidLeavesPerMonth.trim() === "" ? null : Number(paidLeavesPerMonth),
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update staff member.");
      setSubmitting(false);
      return;
    }

    router.push(`/staff/${params.id}`);
    router.refresh();
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit Staff</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Update contact info, status, and work schedule.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Designation</span>
            <select
              value={designation}
              onChange={(event) => setDesignation(event.target.value as (typeof designations)[number])}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              {designations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Mobile</span>
            <input
              value={mobile}
              onChange={(event) => { setMobile(event.target.value); setMobileError(null); }}
              onBlur={(event) => setMobileError(validateMobile(event.target.value))}
              placeholder="10-digit mobile"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
            {mobileError ? <p className="text-xs text-red-600">{mobileError}</p> : null}
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Availability</span>
            <select
              value={availabilityStatus}
              onChange={(event) => setAvailabilityStatus(event.target.value as "AVAILABLE" | "BUSY" | "OFF_DUTY")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="BUSY">BUSY</option>
              <option value="OFF_DUTY">OFF_DUTY</option>
            </select>
          </label>
        </div>

        <section>
          <p className="text-sm font-medium text-[var(--foreground)]">Working Days</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekDays.map((day) => {
              const active = workingDays.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWorkingDay(day)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-[var(--border)] bg-white text-slate-700",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-sm font-medium text-[var(--foreground)]">Salary & Commission</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">Base Salary (₹, monthly)</span>
              <input
                value={baseSalary}
                onChange={(event) => setBaseSalary(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 15000"
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">Commission Rate (%)</span>
              <input
                value={commissionRate}
                onChange={(event) => setCommissionRate(event.target.value)}
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="e.g. 10"
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Commission is calculated on revenue from services this staff member completed.
          </p>

          <label className="mt-4 block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Paid Leaves Per Month</span>
            <input
              value={paidLeavesPerMonth}
              onChange={(event) => setPaidLeavesPerMonth(event.target.value)}
              type="number"
              min={0}
              step="1"
              placeholder={`Salon default (${defaultPaidLeavesPerMonth})`}
              className="h-10 w-full max-w-xs rounded-xl border border-[var(--border)] px-3"
            />
            <p className="text-xs text-[var(--muted)]">
              Leave blank to use the salon&apos;s default paid leave policy ({defaultPaidLeavesPerMonth} days/month). Set
              a specific number to override it for this staff member only.
            </p>
          </label>
        </section>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>

          <Link
            href={`/staff/${params.id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
