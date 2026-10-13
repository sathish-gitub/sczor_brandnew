"use client";

import { useMemo } from "react";

import type { CalendarColorMode } from "@/components/appointments/calendar/AppointmentBlock";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/appointmentStatusStyles";
import { getPaletteEntryForKey } from "@/lib/calendarColorPalette";
import type { CalendarLine, CalendarStaffMember } from "@/lib/calendarTypes";

type CalendarLegendProps = {
  colorMode: CalendarColorMode;
  staff: CalendarStaffMember[];
  lines: CalendarLine[];
};

export function CalendarLegend({ colorMode, staff, lines }: CalendarLegendProps) {
  const entries = useMemo(() => {
    if (colorMode === "status") {
      return (Object.keys(APPOINTMENT_STATUS_STYLES) as Array<keyof typeof APPOINTMENT_STATUS_STYLES>).map((status) => ({
        key: status,
        label: APPOINTMENT_STATUS_STYLES[status].label,
        swatchClassName: APPOINTMENT_STATUS_STYLES[status].dotClassName,
        swatchHex: null as string | null,
      }));
    }

    if (colorMode === "staff") {
      const unique = new Map<string, string>();
      for (const member of staff) {
        unique.set(member.id, member.name);
      }
      unique.set("unassigned", "Unassigned");
      return Array.from(unique.entries()).map(([id, name]) => ({
        key: id,
        label: name,
        swatchClassName: null as string | null,
        swatchHex: getPaletteEntryForKey(id).swatchHex,
      }));
    }

    const unique = new Set<string>();
    for (const line of lines) {
      unique.add(line.serviceCategory);
    }
    return Array.from(unique).map((category) => ({
      key: category,
      label: category,
      swatchClassName: null as string | null,
      swatchHex: getPaletteEntryForKey(category).swatchHex,
    }));
  }, [colorMode, staff, lines]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-[var(--muted)]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {colorMode === "status" ? "Status" : colorMode === "staff" ? "Staff" : "Service category"}
      </span>
      {entries.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1.5">
          <span
            className={entry.swatchClassName ? ["h-2 w-2 rounded-full", entry.swatchClassName].join(" ") : "h-2 w-2 rounded-full"}
            style={entry.swatchHex ? { backgroundColor: entry.swatchHex } : undefined}
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
