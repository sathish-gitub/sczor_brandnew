"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useMemo } from "react";

import { AppointmentBlock, type CalendarColorMode } from "@/components/appointments/calendar/AppointmentBlock";
import {
  SLOT_MINUTES,
  STAFF_COLUMN_WIDTH_PX,
  TIME_COLUMN_WIDTH_PX,
  clockToMinutes,
  layoutOverlappingIntervals,
  minutesToClock,
} from "@/lib/calendarLayout";
import type { CalendarLine } from "@/lib/calendarTypes";
import { formatClockTime12Hour } from "@/lib/time";

export type CalendarColumn = {
  key: string;
  label: string;
  designation?: string;
  /** Full-column unavailability label (Absent / On Leave / Inactive / Off today), or null when available. */
  unavailableLabel: string | null;
  halfDay: boolean;
  /** Unassigned column and single-staff-not-selected contexts never offer click-to-book. */
  bookable: boolean;
};

type CalendarGridProps = {
  businessHours: { open: string; close: string };
  columns: CalendarColumn[];
  linesByColumn: Map<string, CalendarLine[]>;
  /** Pre-built 30-minute row slots ("HH:mm"), already extended to cover every line. */
  slots: string[];
  /** Row height for one 30-minute slot, already scaled to fit the viewport (or the default/min/max). */
  rowHeightPx: number;
  /** Caps the scroll container's height so the grid scrolls internally instead of the page. Null while unmeasured. */
  containerHeightPx: number | null;
  showAvailableSlots: boolean;
  isToday: boolean;
  currentMinutes: number | null;
  isReadOnly: boolean;
  colorMode: CalendarColorMode;
  /** True once there are more staff columns than fit — hides the scrollbar in favour of the toolbar's paging arrows. */
  pagerActive: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenAppointment: (appointmentId: string) => void;
  onSlotClick: (columnKey: string, slotClock: string) => void;
};

export function CalendarGrid({
  businessHours,
  columns,
  linesByColumn,
  slots,
  rowHeightPx,
  containerHeightPx,
  showAvailableSlots,
  isToday,
  currentMinutes,
  isReadOnly,
  colorMode,
  pagerActive,
  scrollContainerRef,
  onScroll,
  onKeyDown,
  onOpenAppointment,
  onSlotClick,
}: CalendarGridProps) {
  const gridStartMinutes = clockToMinutes(slots[0] ?? businessHours.open);
  const openMinutes = clockToMinutes(businessHours.open);
  const closeMinutes = clockToMinutes(businessHours.close);
  const gridHeight = slots.length * rowHeightPx;

  const layoutByColumn = useMemo(() => {
    const result = new Map<string, Map<string, { lane: number; laneCount: number }>>();

    for (const column of columns) {
      const lines = linesByColumn.get(column.key) ?? [];
      const intervals = lines.map((line) => ({
        id: line.id,
        startMinutes: clockToMinutes(line.startClock),
        endMinutes: clockToMinutes(line.endClock),
      }));
      result.set(column.key, layoutOverlappingIntervals(intervals));
    }

    return result;
  }, [columns, linesByColumn]);

  const freeSlotsByColumn = useMemo(() => {
    if (!showAvailableSlots) {
      return new Map<string, Set<string>>();
    }

    const result = new Map<string, Set<string>>();

    for (const column of columns) {
      if (!column.bookable || column.unavailableLabel) {
        continue;
      }

      const lines = linesByColumn.get(column.key) ?? [];
      const free = new Set<string>();

      for (const slot of slots) {
        const slotStart = clockToMinutes(slot);
        if (slotStart >= closeMinutes || slotStart < openMinutes) {
          continue;
        }
        const slotEnd = slotStart + SLOT_MINUTES;
        const busy = lines.some((line) => {
          const start = clockToMinutes(line.startClock);
          const end = clockToMinutes(line.endClock);
          return start < slotEnd && slotStart < end;
        });

        if (!busy) {
          free.add(slot);
        }
      }

      result.set(column.key, free);
    }

    return result;
  }, [columns, linesByColumn, showAvailableSlots, slots, closeMinutes, openMinutes]);

  const currentTimeTop =
    isToday && currentMinutes !== null && currentMinutes >= gridStartMinutes && currentMinutes <= gridStartMinutes + slots.length * SLOT_MINUTES
      ? ((currentMinutes - gridStartMinutes) / SLOT_MINUTES) * rowHeightPx
      : null;

  // The unassigned column is pinned (sticky, right after the time column)
  // only when there are other staff columns to page through alongside it;
  // with just one column on screen there's nothing to pin it against.
  const pinUnassigned = columns.length > 1 && columns[0]?.key === "unassigned";

  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="group"
      aria-label="Day view calendar grid. Use the left and right arrow keys to page through staff columns."
      className={["overflow-auto rounded-lg border border-slate-200 bg-white", pagerActive ? "scrollbar-none" : ""].join(" ")}
      style={{ maxHeight: containerHeightPx ? `${containerHeightPx}px` : undefined }}
    >
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH_PX}px repeat(${columns.length}, minmax(${STAFF_COLUMN_WIDTH_PX}px, 1fr))` }}
      >
        {/* Sticky header row */}
        <div
          className={[
            "sticky top-0 z-20 border-b border-r border-slate-200 px-1 py-1.5 backdrop-blur-sm",
            isToday ? "bg-blue-50/90" : "bg-slate-50/90",
          ].join(" ")}
        />
        {columns.map((column, index) => {
          const isPinned = pinUnassigned && index === 0;
          return (
            <div
              key={column.key}
              className={[
                "z-20 border-b border-slate-200 px-2 py-1.5 backdrop-blur-sm",
                isToday ? "bg-blue-50/90" : "bg-slate-50/90",
                isPinned ? "sticky z-30 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.15)]" : "sticky",
              ].join(" ")}
              style={{ top: 0, left: isPinned ? TIME_COLUMN_WIDTH_PX : undefined }}
            >
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">{column.label}</p>
              {column.designation ? <p className="truncate text-[11px] text-[var(--muted)]">{column.designation}</p> : null}
            </div>
          );
        })}

        {/* Sticky time column */}
        <div className="sticky left-0 z-10 border-r border-slate-200 bg-white" style={{ height: gridHeight }}>
          {slots.map((slot, index) => {
            const isHour = slot.endsWith(":00");
            return (
              <div
                key={slot}
                className={["absolute left-0 right-0 px-1.5 text-right text-[11px] text-[var(--muted)]", isHour ? "border-t border-slate-300" : "border-t border-slate-100"].join(" ")}
                style={{ top: index * rowHeightPx, height: rowHeightPx }}
              >
                {isHour ? <span className="relative -top-2 inline-block bg-white px-0.5">{formatClockTime12Hour(slot)}</span> : null}
              </div>
            );
          })}

          {currentTimeTop !== null && currentMinutes !== null ? (
            <div
              className="pointer-events-none absolute right-0 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-red-500 px-1 py-px text-[10px] font-semibold text-white"
              style={{ top: currentTimeTop }}
            >
              {formatClockTime12Hour(minutesToClock(currentMinutes))}
            </div>
          ) : null}
        </div>

        {columns.map((column, columnIndex) => {
          const lines = linesByColumn.get(column.key) ?? [];
          const layout = layoutByColumn.get(column.key);
          const freeSlots = freeSlotsByColumn.get(column.key);
          const isFullyUnavailable = Boolean(column.unavailableLabel);
          const isPinned = pinUnassigned && columnIndex === 0;

          return (
            <div
              key={column.key}
              className={[
                "relative border-r border-slate-200 last:border-r-0",
                isPinned ? "sticky z-10 bg-white shadow-[2px_0_4px_-2px_rgba(15,23,42,0.1)]" : "",
              ].join(" ")}
              style={{ height: gridHeight, left: isPinned ? TIME_COLUMN_WIDTH_PX : undefined }}
            >
              {slots.map((slot, index) => {
                const slotStart = clockToMinutes(slot);
                const outsideHours = slotStart >= closeMinutes || slotStart < openMinutes;
                const isFree = freeSlots?.has(slot) ?? false;
                const isHour = slot.endsWith(":00");
                const zebra = !outsideHours && !isFullyUnavailable && index % 2 === 1;

                return (
                  <div
                    key={slot}
                    className={[
                      "absolute left-0 right-0",
                      isHour ? "border-t border-slate-300" : "border-t border-slate-100",
                      outsideHours ? "bg-slate-200/70" : "",
                      !outsideHours && isFullyUnavailable ? (column.halfDay ? "bg-slate-200/35" : "bg-slate-200/55") : "",
                      zebra ? "bg-slate-50/60" : "",
                    ].join(" ")}
                    style={{
                      top: index * rowHeightPx,
                      height: rowHeightPx,
                      ...(!outsideHours && isFullyUnavailable
                        ? {
                            backgroundImage:
                              "repeating-linear-gradient(135deg, rgba(100,116,139,0.22) 0px, rgba(100,116,139,0.22) 6px, transparent 6px, transparent 12px)",
                          }
                        : {}),
                    }}
                  >
                    {!outsideHours && !isFullyUnavailable && isFree && column.bookable ? (
                      <button
                        type="button"
                        onClick={() => onSlotClick(column.key, slot)}
                        disabled={isReadOnly}
                        title={isReadOnly ? "Subscription expired — booking is disabled" : `Book ${formatClockTime12Hour(slot)}`}
                        className={[
                          "h-full w-full bg-emerald-50 transition",
                          isReadOnly ? "cursor-not-allowed opacity-60" : "hover:bg-emerald-100",
                        ].join(" ")}
                        aria-label={`${isReadOnly ? "Free slot (booking disabled)" : "Book free slot"} at ${formatClockTime12Hour(slot)} for ${column.label}`}
                      />
                    ) : null}
                  </div>
                );
              })}

              {isFullyUnavailable ? (
                <div className="sticky top-8 z-10 mx-1.5 mt-1.5 w-fit rounded-md bg-slate-700/90 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {column.unavailableLabel}
                </div>
              ) : null}

              {lines.map((line) => {
                const lane = layout?.get(line.id);
                const laneCount = lane?.laneCount ?? 1;
                const laneIndex = lane?.lane ?? 0;
                const top = ((clockToMinutes(line.startClock) - gridStartMinutes) / SLOT_MINUTES) * rowHeightPx;
                const height = ((clockToMinutes(line.endClock) - clockToMinutes(line.startClock)) / SLOT_MINUTES) * rowHeightPx;
                const width = `${100 / laneCount}%`;
                const left = `${(laneIndex * 100) / laneCount}%`;

                return (
                  <AppointmentBlock
                    key={line.id}
                    line={line}
                    top={Math.max(top, 0)}
                    height={Math.max(height, 18)}
                    left={left}
                    width={width}
                    colorMode={colorMode}
                    onOpen={onOpenAppointment}
                  />
                );
              })}

              {currentTimeTop !== null ? (
                <div className="pointer-events-none absolute left-0 right-0 z-30 border-t-2 border-red-500" style={{ top: currentTimeTop }}>
                  <span className="absolute -top-1.5 left-0 h-3 w-3 rounded-full bg-red-500" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
