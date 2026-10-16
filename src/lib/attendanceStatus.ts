/**
 * Single source of truth for attendance status names, labels, colours and
 * the "what status applies to this staff member on this date" rule, used by
 * the attendance page, monthly reports, the dashboard staff-availability
 * widget, staff cards and the Day View calendar's column greying — so all of
 * them show the same five statuses with the same wording and colours.
 *
 * Week Off rule: an explicit stored `Attendance` row always wins (so a staff
 * member can be given a rotating week off on any date, or have an automatic
 * week off overridden back to Present/Absent). Failing that, a date that is
 * not an enabled business-hours weekday (see `src/lib/businessHours.ts`) is
 * an automatic Week Off with no stored row. Otherwise, a working day with no
 * stored row is "Not Marked".
 */

export const ATTENDANCE_STATUS_VALUES = ["PRESENT", "ABSENT", "LEAVE", "WEEK_OFF", "HALF_DAY"] as const;

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUS_VALUES)[number];

/** `AttendanceStatusValue` plus the "no record, salon open, nothing marked yet" case. */
export type DisplayAttendanceStatus = AttendanceStatusValue | "NOT_MARKED";

type AttendanceStatusStyle = {
  /** Canonical display name, used everywhere (dropdowns, badges, reports, calendar). */
  label: string;
  /** Single-letter form for compact report grid cells. */
  shortLabel: string;
  /** Small coloured dot, e.g. next to a name. */
  dotClassName: string;
  /** Pill/badge background + text colour. */
  badgeClassName: string;
  /** Table/report cell background + text colour. */
  cellClassName: string;
};

const ATTENDANCE_STATUS_STYLES: Record<AttendanceStatusValue, AttendanceStatusStyle> = {
  PRESENT: {
    label: "Present",
    shortLabel: "P",
    dotClassName: "bg-emerald-500",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    cellClassName: "bg-emerald-50 text-emerald-700",
  },
  ABSENT: {
    label: "Absent",
    shortLabel: "A",
    dotClassName: "bg-red-500",
    badgeClassName: "bg-red-100 text-red-700",
    cellClassName: "bg-red-50 text-red-700",
  },
  LEAVE: {
    label: "Leave",
    shortLabel: "L",
    dotClassName: "bg-yellow-500",
    badgeClassName: "bg-yellow-100 text-yellow-700",
    cellClassName: "bg-yellow-50 text-yellow-700",
  },
  WEEK_OFF: {
    label: "Week Off",
    shortLabel: "W",
    dotClassName: "bg-indigo-500",
    badgeClassName: "bg-indigo-100 text-indigo-700",
    cellClassName: "bg-indigo-50 text-indigo-700",
  },
  HALF_DAY: {
    label: "Half Day",
    shortLabel: "H",
    dotClassName: "bg-orange-500",
    badgeClassName: "bg-orange-100 text-orange-700",
    cellClassName: "bg-orange-50 text-orange-700",
  },
};

const NOT_MARKED_STYLE: AttendanceStatusStyle = {
  label: "Not Marked",
  shortLabel: "-",
  dotClassName: "bg-slate-300",
  badgeClassName: "bg-slate-100 text-slate-500",
  cellClassName: "bg-slate-50 text-slate-400",
};

export function getAttendanceStatusStyle(status: DisplayAttendanceStatus | null | undefined): AttendanceStatusStyle {
  if (!status || status === "NOT_MARKED") {
    return NOT_MARKED_STYLE;
  }

  return ATTENDANCE_STATUS_STYLES[status];
}

export function getAttendanceStatusLabel(status: DisplayAttendanceStatus | null | undefined): string {
  return getAttendanceStatusStyle(status).label;
}

/** Zeroed counts for the five stored statuses — does not include "Not Marked" (that is a derived display-only state, never stored or counted as a day). */
export function emptyAttendanceStatusCounts(): Record<AttendanceStatusValue, number> {
  return { PRESENT: 0, ABSENT: 0, LEAVE: 0, WEEK_OFF: 0, HALF_DAY: 0 };
}

/**
 * The single rule for "what status does this staff member show on this
 * date": an explicit stored row always wins (manual override, including a
 * rotating Week Off or a Present/Absent override on an otherwise-closed
 * day); otherwise an automatic Week Off on a day the salon's business hours
 * mark as not an enabled weekday; otherwise "Not Marked".
 */
export function resolveAttendanceDisplayStatus({
  storedStatus,
  isBusinessWorkingDay,
}: {
  storedStatus: AttendanceStatusValue | null | undefined;
  isBusinessWorkingDay: boolean;
}): DisplayAttendanceStatus {
  if (storedStatus) {
    return storedStatus;
  }

  if (!isBusinessWorkingDay) {
    return "WEEK_OFF";
  }

  return "NOT_MARKED";
}

/** Whether a (stored or automatic) status counts as a fully/partially paid day for payroll purposes. Half Day is paid but at half rate, handled separately by the caller. */
export function isPaidAttendanceStatus(status: AttendanceStatusValue): boolean {
  return status === "PRESENT" || status === "HALF_DAY" || status === "WEEK_OFF";
}

/** Label for inactive staff member status (shown instead of "Inactive" in UI to indicate unavailability). */
export function getInactiveStaffLabel(): string {
  return "Unavailable";
}

/** Label for the manual Availability status enum (AVAILABLE/BUSY/OFF_DUTY). OFF_DUTY is displayed as "Week Off" for consistency with the attendance statuses. */
export function getAvailabilityStatusLabel(status: "AVAILABLE" | "BUSY" | "OFF_DUTY"): string {
  if (status === "AVAILABLE") return "Available";
  if (status === "BUSY") return "Busy";
  return "Week Off"; // OFF_DUTY displayed as "Week Off"
}

/**
 * Compute the record status and availability labels for a staff member.
 * When a staff member is Inactive, availability always shows "Unavailable" regardless of stored availabilityStatus.
 * When Active, availability shows the result of getAvailabilityStatusLabel().
 * 
 * Returns { recordStatusLabel, recordStatusBadgeClassName, availabilityLabel, availabilityBadgeClassName }
 */
export function getStaffStatusLabels(staff: {
  status: "ACTIVE" | "INACTIVE";
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
}): {
  recordStatusLabel: string;
  recordStatusBadgeClassName: string;
  availabilityLabel: string;
  availabilityBadgeClassName: string;
} {
  const recordStatusLabel = staff.status === "ACTIVE" ? "Active" : "Inactive";
  const recordStatusBadgeClassName =
    staff.status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700";

  if (staff.status === "INACTIVE") {
    return {
      recordStatusLabel,
      recordStatusBadgeClassName,
      availabilityLabel: "Unavailable",
      availabilityBadgeClassName: "bg-slate-100 text-slate-700",
    };
  }

  const availabilityLabel = getAvailabilityStatusLabel(staff.availabilityStatus);
  const availabilityBadgeClassName =
    staff.availabilityStatus === "AVAILABLE"
      ? "bg-emerald-100 text-emerald-700"
      : staff.availabilityStatus === "BUSY"
        ? "bg-amber-100 text-amber-700"
        : "bg-indigo-100 text-indigo-700";

  return {
    recordStatusLabel,
    recordStatusBadgeClassName,
    availabilityLabel,
    availabilityBadgeClassName,
  };
}

