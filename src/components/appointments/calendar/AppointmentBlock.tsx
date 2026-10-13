"use client";

import { useId, useState } from "react";

import { getPaletteEntryForKey } from "@/lib/calendarColorPalette";
import { APPOINTMENT_STATUS_STYLES } from "@/lib/appointmentStatusStyles";
import type { CalendarLine } from "@/lib/calendarTypes";
import { formatClockTime12Hour } from "@/lib/time";

export type CalendarColorMode = "status" | "staff" | "service";

type AppointmentBlockProps = {
  line: CalendarLine;
  top: number;
  height: number;
  left: string;
  width: string;
  colorMode: CalendarColorMode;
  onOpen: (appointmentId: string) => void;
};

export function AppointmentBlock({ line, top, height, left, width, colorMode, onOpen }: AppointmentBlockProps) {
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const statusStyle = APPOINTMENT_STATUS_STYLES[line.status];

  // Below this height there isn't room for both the start and end time, so
  // only the start time is shown; below the next threshold there's no room
  // for the customer name either.
  const compact = height < 36;
  const showCustomer = height >= 52;

  const colorClassName =
    colorMode === "status"
      ? statusStyle.blockClassName
      : getPaletteEntryForKey(colorMode === "staff" ? line.staffId ?? "unassigned" : line.serviceCategory).blockClassName;

  return (
    <div
      className="absolute px-px"
      style={{ top, height, left, width }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-describedby={hovered ? tooltipId : undefined}
        onClick={() => onOpen(line.appointmentId)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={[
          "h-full w-full overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
          colorClassName,
          statusStyle.strikeThrough ? "line-through opacity-80" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-semibold">
            {formatClockTime12Hour(line.startClock)}
            {!compact ? ` - ${formatClockTime12Hour(line.endClock)}` : ""}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {colorMode !== "status" ? (
              <span
                aria-hidden="true"
                title={statusStyle.label}
                className={["h-1.5 w-1.5 shrink-0 rounded-full", statusStyle.dotClassName].join(" ")}
              />
            ) : null}
            {line.lineCount > 1 ? (
              <span className="shrink-0 rounded-full bg-white/70 px-1 text-[10px] font-bold">
                {line.lineIndex}/{line.lineCount}
              </span>
            ) : null}
          </span>
        </div>
        <p className="truncate font-medium text-[11px]">{line.serviceName}</p>
        {showCustomer ? <p className="truncate text-[11px] opacity-80">{line.customerName}</p> : null}
      </button>

      {hovered ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-0 z-50 w-56 -translate-y-full rounded-lg border border-[var(--border)] bg-white p-2.5 text-xs shadow-xl"
        >
          <p className="font-semibold text-[var(--foreground)]">{line.serviceName}</p>
          <p className="mt-1 text-[var(--muted)]">
            {formatClockTime12Hour(line.startClock)} - {formatClockTime12Hour(line.endClock)}
          </p>
          <p className="mt-1 text-[var(--muted)]">{line.customerName}</p>
          <p className="text-[var(--muted)]">{line.staffName ?? "Unassigned"}</p>
          {line.lineCount > 1 ? (
            <p className="mt-1 font-medium text-[var(--foreground)]">
              Service {line.lineIndex} of {line.lineCount} in this appointment
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
