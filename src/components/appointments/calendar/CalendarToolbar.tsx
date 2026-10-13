"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { CalendarColorMode } from "@/components/appointments/calendar/AppointmentBlock";
import { addDaysToDateString, todayISTDateString } from "@/lib/time";

export type StaffFilterOption = {
  id: string;
  name: string;
  designation: string;
};

export type StaffPagerInfo = {
  start: number;
  end: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
};

type CalendarToolbarProps = {
  date: string;
  onDateChange: (date: string) => void;
  staffOptions: StaffFilterOption[];
  staffFilter: string | null;
  onStaffFilterChange: (value: string | null) => void;
  staffPager: StaffPagerInfo | null;
  onStaffPagePrev: () => void;
  onStaffPageNext: () => void;
  showCancelled: boolean;
  onToggleShowCancelled: () => void;
  showAvailableSlots: boolean;
  onToggleShowAvailableSlots: () => void;
  colorMode: CalendarColorMode;
  onColorModeChange: (mode: CalendarColorMode) => void;
};

const COLOR_MODE_OPTIONS: Array<{ value: CalendarColorMode; label: string }> = [
  { value: "status", label: "Status" },
  { value: "staff", label: "Staff" },
  { value: "service", label: "Service category" },
];

export function CalendarToolbar({
  date,
  onDateChange,
  staffOptions,
  staffFilter,
  onStaffFilterChange,
  staffPager,
  onStaffPagePrev,
  onStaffPageNext,
  showCancelled,
  onToggleShowCancelled,
  showAvailableSlots,
  onToggleShowAvailableSlots,
  colorMode,
  onColorModeChange,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:p-3.5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDateChange(addDaysToDateString(date, -1))}
            aria-label="Previous day"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <input
            type="date"
            value={date}
            onChange={(event) => event.target.value && onDateChange(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          />

          <button
            type="button"
            onClick={() => onDateChange(addDaysToDateString(date, 1))}
            aria-label="Next day"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDateChange(todayISTDateString())}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 px-2.5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]"
          >
            Today
          </button>
        </div>

        {/* Staff filter + staff-column pager: top-right per spec. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {staffPager ? (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-1 py-0.5">
              <button
                type="button"
                onClick={onStaffPagePrev}
                disabled={!staffPager.canPrev}
                aria-label="Show previous staff columns"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-0.5 text-[11px] font-medium text-[var(--muted)]">
                Staff {staffPager.start + 1}-{staffPager.end} of {staffPager.total}
              </span>
              <button
                type="button"
                onClick={onStaffPageNext}
                disabled={!staffPager.canNext}
                aria-label="Show next staff columns"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-sm">
            <span className="text-[var(--muted)]">Staff</span>
            <select
              value={staffFilter ?? "ALL"}
              onChange={(event) => onStaffFilterChange(event.target.value === "ALL" ? null : event.target.value)}
              className="bg-transparent font-semibold text-[var(--foreground)] outline-none"
            >
              <option value="ALL">All Staff</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={showCancelled} onChange={onToggleShowCancelled} className="h-3.5 w-3.5 rounded border-slate-300" />
          <span className="text-[var(--foreground)]">Show cancelled</span>
        </label>

        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showAvailableSlots}
            onChange={onToggleShowAvailableSlots}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          <span className="text-[var(--foreground)]">Available slots</span>
        </label>

        <div className="inline-flex items-center gap-1.5">
          <span className="text-[var(--muted)]">Colour by</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            {COLOR_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onColorModeChange(option.value)}
                aria-pressed={colorMode === option.value}
                className={[
                  "px-2 py-1 text-[11px] font-semibold transition",
                  colorMode === option.value ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--muted)] hover:bg-slate-50",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
