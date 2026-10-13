"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DesignationSelect } from "@/components/staff/DesignationSelect";
import { SpecializationChips } from "@/components/staff/SpecializationChips";
import { todayISTDateString } from "@/lib/time";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default function NewStaffPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [availabilityStatus, setAvailabilityStatus] = useState<"AVAILABLE" | "BUSY" | "OFF_DUTY">("AVAILABLE");
  const [workingDays, setWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [suggestionPool, setSuggestionPool] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSuggestions() {
      try {
        const [categoriesRes, staffRes] = await Promise.all([
          fetch("/api/services/categories", { cache: "no-store" }),
          fetch("/api/staff", { cache: "no-store" }),
        ]);
        const categoriesPayload = (await categoriesRes.json().catch(() => null)) as { items?: { name: string }[] } | null;
        const staffPayload = (await staffRes.json().catch(() => null)) as { items?: { specializations?: string[] }[] } | null;

        if (!active) {
          return;
        }

        const categoryNames = (categoriesPayload?.items ?? []).map((item) => item.name);
        const usedSpecializations = (staffPayload?.items ?? []).flatMap((item) => item.specializations ?? []);
        setSuggestionPool([...new Set([...categoryNames, ...usedSpecializations])]);
      } catch {
        // Suggestions are a nice-to-have; ignore failures silently.
      }
    }

    loadSuggestions();

    return () => {
      active = false;
    };
  }, []);

  function validateMobile(value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");
    if (value.length > 0 && cleaned.length !== 10) {
      return "Mobile number must be exactly 10 digits.";
    }
    return null;
  }

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

    if (!designationId) {
      setError("Select a designation.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        designationId,
        mobile,
        email,
        status,
        availabilityStatus,
        workingDays,
        dateOfBirth: dateOfBirth || null,
        joiningDate: joiningDate || null,
        experienceYears: experienceYears.trim() === "" ? null : Number(experienceYears),
        specializations,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to create staff member.");
      setSubmitting(false);
      return;
    }

    router.push("/staff");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Add Staff</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Create a staff profile with schedule and availability settings.</p>
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

          <div className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Designation</span>
            <DesignationSelect value={designationId} onChange={setDesignationId} />
          </div>
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
              <option value="AVAILABLE">Available</option>
              <option value="BUSY">Busy</option>
              <option value="OFF_DUTY">Week Off</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Date of Birth</span>
            <input
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              type="date"
              max={todayISTDateString()}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Joining Date</span>
            <input
              value={joiningDate}
              onChange={(event) => setJoiningDate(event.target.value)}
              type="date"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Experience (years)</span>
            <input
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              type="number"
              min={0}
              max={60}
              step="0.1"
              placeholder="e.g. 3.5"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Specialization</span>
          <SpecializationChips value={specializations} onChange={setSpecializations} suggestions={suggestionPool} />
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

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Staff"}
          </button>

          <Link
            href="/staff"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
