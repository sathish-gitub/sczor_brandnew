"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarOff, LoaderCircle } from "lucide-react";

import { useAccess } from "@/contexts/AccessContext";
import type { CalendarColorMode } from "@/components/appointments/calendar/AppointmentBlock";
import { AppointmentDetailPanel } from "@/components/appointments/calendar/AppointmentDetailPanel";
import { AppointmentViewTabs } from "@/components/appointments/calendar/AppointmentViewTabs";
import { CalendarGrid, type CalendarColumn } from "@/components/appointments/calendar/CalendarGrid";
import { CalendarLegend } from "@/components/appointments/calendar/CalendarLegend";
import { CalendarToolbar, type StaffPagerInfo } from "@/components/appointments/calendar/CalendarToolbar";
import { SummaryStrip } from "@/components/appointments/calendar/SummaryStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SLOT_MINUTES,
  STAFF_COLUMN_WIDTH_PX,
  TIME_COLUMN_WIDTH_PX,
  buildGridSlots,
  clockToMinutes,
  computeRowHeightPx,
} from "@/lib/calendarLayout";
import { groupLinesByAppointment, type CalendarResponse } from "@/lib/calendarTypes";
import { nowISTMinutesOfDay, todayISTDateString } from "@/lib/time";

const POLL_INTERVAL_MS = 60_000;
const COLOR_MODE_STORAGE_KEY = "sczor:calendar:colorMode";
/** Space reserved below the measured grid top so the "Refreshing…" line and page padding never force the whole page to scroll. */
const BOTTOM_GUTTER_PX = 32;
/** Floor so the grid never collapses to nothing while the toolbar/banners are still laying out. */
const MIN_AVAILABLE_HEIGHT_PX = 220;

function GridSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="h-9 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function DayViewCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const access = useAccess();
  const isReadOnly = access.accessLevel === "READ_ONLY";

  const date = searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!)
    ? searchParams.get("date")!
    : todayISTDateString();
  const staffFilter = searchParams.get("staff");

  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [showAvailableSlots, setShowAvailableSlots] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [colorMode, setColorMode] = useState<CalendarColorMode>("status");
  const autoSelectedMobileStaff = useRef(false);

  // Restore the "Colour by" preference saved on a previous visit; ignored
  // entirely (falls back to "status") if storage is unavailable or blocked.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
      if (stored === "status" || stored === "staff" || stored === "service") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage on mount
        setColorMode(stored);
      }
    } catch {
      // Private browsing / disabled storage — keep the default.
    }
  }, []);

  function handleColorModeChange(mode: CalendarColorMode) {
    setColorMode(mode);
    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage write failures; the choice just won't persist.
    }
  }

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ date });
      if (staffFilter) {
        params.set("staffId", staffFilter);
      }

      const response = await fetch(`/api/appointments/calendar?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CalendarResponse | { error?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Unable to load the day view calendar.");
      }

      setData(payload as CalendarResponse);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load the day view calendar.");
    } finally {
      setLoading(false);
    }
  }, [date, staffFilter]);

  useEffect(() => {
    // Data-fetching effect: re-fetch whenever the date/staff filter changes.
    // fetchCalendar sets loading/error/data state internally (same idiom used
    // elsewhere in this codebase, e.g. AppointmentForm's availability loader).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCalendar();
  }, [fetchCalendar]);

  // Poll every 60s while the tab is visible; skip while hidden to save requests.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchCalendar();
      }
    }, POLL_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchCalendar();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCalendar]);

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.matchMedia("(max-width: 640px)").matches);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Phones default to a single-staff column instead of a squeezed multi-column grid.
  useEffect(() => {
    if (!isMobile || staffFilter || autoSelectedMobileStaff.current || !data) {
      return;
    }

    autoSelectedMobileStaff.current = true;
    const firstStaffId = data.staff[0]?.id;
    if (firstStaffId) {
      updateQuery({ staff: firstStaffId });
    }
  }, [isMobile, staffFilter, data, updateQuery]);

  const visibleLines = useMemo(() => {
    if (!data) {
      return [];
    }
    return showCancelled ? data.lines : data.lines.filter((line) => line.status !== "CANCELLED");
  }, [data, showCancelled]);

  const columns: CalendarColumn[] = useMemo(() => {
    if (!data) {
      return [];
    }

    const staffColumns: CalendarColumn[] = data.staff.map((member) => ({
      key: member.id,
      label: member.name,
      designation: member.designation,
      unavailableLabel: member.unavailableLabel,
      halfDay: member.halfDay,
      bookable: true,
    }));

    const showUnassigned = staffFilter === "unassigned" || !staffFilter;

    if (!showUnassigned) {
      return staffColumns;
    }

    const unassignedColumn: CalendarColumn = {
      key: "unassigned",
      label: "Unassigned",
      unavailableLabel: null,
      halfDay: false,
      bookable: false,
    };

    // Unassigned is pinned first (leftmost, right after the time column) so
    // it stays visible while paging through the other staff columns.
    return staffFilter === "unassigned" ? [unassignedColumn] : [unassignedColumn, ...staffColumns];
  }, [data, staffFilter]);

  const linesByColumn = useMemo(() => {
    const map = new Map<string, typeof visibleLines>();
    for (const line of visibleLines) {
      const key = line.staffId ?? "unassigned";
      const list = map.get(key);
      if (list) {
        list.push(line);
      } else {
        map.set(key, [line]);
      }
    }
    return map;
  }, [visibleLines]);

  const appointmentGroups = useMemo(() => groupLinesByAppointment(data?.lines ?? []), [data]);
  const selectedGroup = selectedAppointmentId ? appointmentGroups.get(selectedAppointmentId) ?? null : null;

  const isToday = date === todayISTDateString();
  const currentMinutes = isToday ? nowISTMinutesOfDay() : null;

  // --- Grid geometry: build the 30-minute row slots and scale the row
  // height to fit the viewport below the toolbar (see the measurement
  // effect further down), so the whole opening-to-closing range is visible
  // without the page itself scrolling, where that's possible. ---
  const slots = useMemo(() => {
    if (!data || data.businessHours.closed) {
      return [];
    }
    const furthestEnd = visibleLines.reduce((max, line) => Math.max(max, clockToMinutes(line.endClock)), 0);
    const earliestStart = visibleLines.reduce(
      (min, line) => Math.min(min, clockToMinutes(line.startClock)),
      clockToMinutes(data.businessHours.open),
    );
    return buildGridSlots(data.businessHours.open, data.businessHours.close, furthestEnd, earliestStart);
  }, [data, visibleLines]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const measure = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    setAvailableHeight(Math.max(window.innerHeight - rect.top - BOTTOM_GUTTER_PX, MIN_AVAILABLE_HEIGHT_PX));
    setContainerWidth(rect.width);
  }, []);

  // Re-measure whenever content above the grid could have changed height
  // (loading/error/empty states, the summary strip appearing, etc.) — run
  // before paint to avoid a visible resize flash.
  useLayoutEffect(() => {
    measure();
  }, [measure, data, loading, error]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    // Catches late-arriving layout shifts above the grid (e.g. the trial/
    // read-only banner's async refresh in DashboardShell).
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 1200);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [measure]);

  const rowHeightPx = computeRowHeightPx(availableHeight, slots.length);
  const gridHeightPx = slots.length * rowHeightPx;
  const containerHeightPx = availableHeight !== null ? Math.min(availableHeight, gridHeightPx) : null;

  // Scroll to show the current time on first load of today's view, only
  // when the grid doesn't already fit entirely (otherwise it starts at the
  // top, i.e. opening time, which needs no action).
  const hasAutoScrolledRef = useRef(false);
  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [date]);

  useEffect(() => {
    if (hasAutoScrolledRef.current || !isToday || currentMinutes === null || availableHeight === null || slots.length === 0) {
      return;
    }
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const containerHeight = Math.min(availableHeight, gridHeightPx);
    if (gridHeightPx <= containerHeight) {
      return;
    }
    const gridStartMinutes = clockToMinutes(slots[0]);
    const currentTimeTop = ((currentMinutes - gridStartMinutes) / SLOT_MINUTES) * rowHeightPx;
    hasAutoScrolledRef.current = true;
    el.scrollTop = Math.max(currentTimeTop - containerHeight / 3, 0);
  }, [isToday, currentMinutes, availableHeight, gridHeightPx, rowHeightPx, slots]);

  // --- Staff-column pager: pages through staff columns (Unassigned stays
  // pinned) when there are more than fit the measured container width. ---
  const [staffPageStart, setStaffPageStart] = useState(0);

  useEffect(() => {
    // Resets the pager whenever the date/staff filter changes so paging
    // state never carries over to an unrelated view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaffPageStart(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [date, staffFilter]);

  const hasUnassignedColumn = columns.some((column) => column.key === "unassigned");
  const staffOnlyCount = columns.length - (hasUnassignedColumn ? 1 : 0);
  const fixedWidthPx = TIME_COLUMN_WIDTH_PX + (hasUnassignedColumn ? STAFF_COLUMN_WIDTH_PX : 0);
  const visibleStaffCount = Math.max(1, Math.floor(Math.max(containerWidth - fixedWidthPx, 0) / STAFF_COLUMN_WIDTH_PX));
  const pagerActive = columns.length > 1 && staffOnlyCount > visibleStaffCount;

  const staffPager: StaffPagerInfo | null = pagerActive
    ? {
        start: staffPageStart,
        end: Math.min(staffPageStart + visibleStaffCount, staffOnlyCount),
        total: staffOnlyCount,
        canPrev: staffPageStart > 0,
        canNext: staffPageStart + visibleStaffCount < staffOnlyCount,
      }
    : null;

  function pageStaffColumns(direction: "prev" | "next") {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const delta = visibleStaffCount * STAFF_COLUMN_WIDTH_PX * (direction === "next" ? 1 : -1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  const scrollRafRef = useRef<number | null>(null);
  function handleGridScroll() {
    if (scrollRafRef.current !== null) {
      return;
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) {
        return;
      }
      const maxStart = Math.max(0, staffOnlyCount - visibleStaffCount);
      setStaffPageStart(Math.max(0, Math.min(Math.round(el.scrollLeft / STAFF_COLUMN_WIDTH_PX), maxStart)));
    });
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!pagerActive) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      pageStaffColumns("prev");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      pageStaffColumns("next");
    }
  }

  const summary = useMemo(() => {
    const appointmentIds = new Set(visibleLines.map((line) => line.appointmentId));
    const unassignedCount = visibleLines.filter((line) => !line.staffId).length;

    // Free-slot count for the filtered staff is always shown in the summary
    // strip, independent of the "Available slots" grid-shading toggle.
    let freeSlotCount: number | null = null;
    if (data && !data.businessHours.closed) {
      const closeMinutes = clockToMinutes(data.businessHours.close);
      freeSlotCount = 0;

      for (const column of columns) {
        if (!column.bookable || column.unavailableLabel) {
          continue;
        }
        const lines = linesByColumn.get(column.key) ?? [];
        const openMinutes = clockToMinutes(data.businessHours.open);
        for (let slot = openMinutes; slot < closeMinutes; slot += 30) {
          const busy = lines.some((line) => {
            const start = clockToMinutes(line.startClock);
            const end = clockToMinutes(line.endClock);
            return start < slot + 30 && slot < end;
          });
          if (!busy) {
            freeSlotCount += 1;
          }
        }
      }
    }

    return {
      appointmentCount: appointmentIds.size,
      lineCount: visibleLines.length,
      unassignedCount,
      freeSlotCount,
    };
  }, [visibleLines, data, columns, linesByColumn]);

  function handleSlotClick(columnKey: string, slotClock: string) {
    if (isReadOnly || columnKey === "unassigned") {
      return;
    }
    const params = new URLSearchParams({ date, time: slotClock, staffId: columnKey });
    router.push(`/appointments/new?${params.toString()}`);
  }

  function handleStatusChanged(appointmentId: string, status: CalendarResponse["lines"][number]["status"]) {
    setData((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        lines: previous.lines.map((line) => (line.appointmentId === appointmentId ? { ...line, status } : line)),
      };
    });

    if (status === "CANCELLED") {
      setSelectedAppointmentId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Appointments</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Day View — see every staff member&apos;s schedule at a glance.</p>
        </div>
        <AppointmentViewTabs active="calendar" />
      </div>

      <CalendarToolbar
        date={date}
        onDateChange={(nextDate) => updateQuery({ date: nextDate })}
        staffOptions={data?.staff ?? []}
        staffFilter={staffFilter}
        onStaffFilterChange={(value) => updateQuery({ staff: value })}
        staffPager={staffPager}
        onStaffPagePrev={() => pageStaffColumns("prev")}
        onStaffPageNext={() => pageStaffColumns("next")}
        showCancelled={showCancelled}
        onToggleShowCancelled={() => setShowCancelled((value) => !value)}
        showAvailableSlots={showAvailableSlots}
        onToggleShowAvailableSlots={() => setShowAvailableSlots((value) => !value)}
        colorMode={colorMode}
        onColorModeChange={handleColorModeChange}
      />

      <CalendarLegend colorMode={colorMode} staff={data?.staff ?? []} lines={visibleLines} />

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </span>
          <button
            type="button"
            onClick={() => fetchCalendar()}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !data ? <GridSkeleton /> : null}

      {!loading && !error && data ? (
        <>
          <SummaryStrip
            appointmentCount={summary.appointmentCount}
            lineCount={summary.lineCount}
            unassignedCount={summary.unassignedCount}
            freeSlotCount={summary.freeSlotCount}
          />

          {data.businessHours.closed ? (
            <EmptyState
              icon={<CalendarOff className="h-6 w-6" />}
              title={data.businessHours.closedReason ?? "Closed on this day"}
              description="There are no business hours configured for this date."
            />
          ) : visibleLines.length === 0 && !showAvailableSlots ? (
            <EmptyState title="No appointments on this day" description="Nothing booked yet — free time is shown across every column." />
          ) : null}

          {!data.businessHours.closed ? (
            <CalendarGrid
              businessHours={data.businessHours}
              columns={columns}
              linesByColumn={linesByColumn}
              slots={slots}
              rowHeightPx={rowHeightPx}
              containerHeightPx={containerHeightPx}
              showAvailableSlots={showAvailableSlots}
              isToday={isToday}
              currentMinutes={currentMinutes}
              isReadOnly={isReadOnly}
              colorMode={colorMode}
              pagerActive={pagerActive}
              scrollContainerRef={scrollContainerRef}
              onScroll={handleGridScroll}
              onKeyDown={handleGridKeyDown}
              onOpenAppointment={setSelectedAppointmentId}
              onSlotClick={handleSlotClick}
            />
          ) : null}
        </>
      ) : null}

      {loading && data ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Refreshing…
        </div>
      ) : null}

      {selectedGroup ? (
        <AppointmentDetailPanel
          group={selectedGroup}
          salonName={data?.salonName ?? ""}
          salonPhone={data?.salonPhone ?? null}
          isReadOnly={isReadOnly}
          onClose={() => setSelectedAppointmentId(null)}
          onStatusChanged={handleStatusChanged}
          onRefetch={fetchCalendar}
        />
      ) : null}
    </div>
  );
}
