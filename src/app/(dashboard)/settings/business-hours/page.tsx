"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type BusinessDay = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  enabled: boolean;
  open: string;
  close: string;
  break: string;
};

type Holiday = {
  id?: string;
  date: string;
  name: string;
};

const defaultDays: BusinessDay[] = [
  { day: "Mon", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Tue", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Wed", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Thu", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Fri", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Sat", enabled: true, open: "09:00", close: "21:00", break: "" },
  { day: "Sun", enabled: false, open: "09:00", close: "21:00", break: "" },
];

export default function BusinessHoursPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<BusinessDay[]>(defaultDays);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        businessHours?: {
          days: BusinessDay[];
          slotDurationMinutes: number;
          holidays: Holiday[];
        };
      } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.businessHours) {
        showToast({ variant: "error", title: "Unable to load business hours", message: payload?.error });
        setLoading(false);
        return;
      }

      setDays(payload.businessHours.days);
      setSlotDurationMinutes(payload.businessHours.slotDurationMinutes);
      setHolidays(payload.businessHours.holidays);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [showToast]);

  const upcomingHolidays = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays],
  );

  function addHoliday() {
    if (!holidayDate || holidayName.trim().length < 2) {
      showToast({ variant: "warning", title: "Enter holiday date and name" });
      return;
    }

    const alreadyExists = holidays.some((holiday) => holiday.date === holidayDate);
    if (alreadyExists) {
      showToast({ variant: "warning", title: "Holiday already added for this date" });
      return;
    }

    setHolidays((current) => [...current, { date: holidayDate, name: holidayName.trim() }]);
    setHolidayDate("");
    setHolidayName("");
  }

  async function onSave() {
    const activeDays = days.filter((day) => day.enabled).length;
    if (activeDays === 0) {
      showToast({ variant: "warning", title: "Enable at least one working day" });
      return;
    }

    setSaving(true);

    const response = await fetch("/api/settings/business-hours", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        days,
        slotDurationMinutes,
        holidays,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Save failed", message: payload?.error ?? "Unable to update settings." });
      setSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Business hours updated" });
    setSaving(false);
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Business Hours"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Business Hours" },
        ]}
      />

      <section className="space-y-5 rounded-xl border border-[var(--border)] bg-white p-5">
        <div>
          <h2 className="text-base font-semibold">Working Days</h2>
          <div className="mt-3 space-y-3">
            {days.map((day, index) => (
              <div key={day.day} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[80px_120px_120px_1fr] md:items-center">
                <label className="inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, enabled: event.target.checked } : item)),
                      )
                    }
                  />
                  {day.day}
                </label>

                <input
                  type="time"
                  disabled={!day.enabled}
                  value={day.open}
                  onChange={(event) =>
                    setDays((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, open: event.target.value } : item)))
                  }
                  className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm disabled:opacity-60"
                />
                <input
                  type="time"
                  disabled={!day.enabled}
                  value={day.close}
                  onChange={(event) =>
                    setDays((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, close: event.target.value } : item)))
                  }
                  className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm disabled:opacity-60"
                />
                <input
                  placeholder="Break 13:00-14:00"
                  disabled={!day.enabled}
                  value={day.break}
                  onChange={(event) =>
                    setDays((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, break: event.target.value } : item)))
                  }
                  className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold">Holiday Management</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm" />
            <input value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="Holiday name" className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm" />
            <button type="button" onClick={addHoliday} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Add</button>
          </div>

          <div className="mt-3 space-y-2">
            {upcomingHolidays.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No upcoming holidays.</p>
            ) : (
              upcomingHolidays.map((holiday, index) => (
                <div key={`${holiday.date}-${holiday.name}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                  <p className="text-sm">
                    <span className="font-semibold">{holiday.date}</span> - {holiday.name}
                  </p>
                  <button type="button" onClick={() => setRemoveIndex(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold">Appointment Slot Duration</h2>
          <select
            value={slotDurationMinutes}
            onChange={(event) => setSlotDurationMinutes(Number(event.target.value))}
            className="mt-2 h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>

        <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Business Hours"}
        </button>
      </section>

      <ConfirmDialog
        open={removeIndex !== null}
        title="Delete holiday"
        message="This holiday will be removed from your business calendar."
        danger
        confirmText="Delete"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={() => {
          if (removeIndex === null) {
            return;
          }
          setHolidays((current) => current.filter((_, index) => index !== removeIndex));
          setRemoveIndex(null);
        }}
      />
    </div>
  );
}
