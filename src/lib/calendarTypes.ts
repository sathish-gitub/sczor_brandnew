/**
 * Shared, client-safe types for the Day View calendar (`/api/appointments/calendar`
 * response plus UI-only derived shapes). No server-only imports here so this
 * can be used from both the API route and client components.
 */
import type { AppointmentStatusValue } from "@/lib/appointmentStatusStyles";

export type CalendarAttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "WEEK_OFF" | null;

export type CalendarStaffMember = {
  id: string;
  name: string;
  designation: string;
  status: "ACTIVE" | "INACTIVE";
  /** Attendance row for the selected date, if any. */
  attendanceStatus: CalendarAttendanceStatus;
  /** Whether the selected date's weekday is in this staff member's `workingDays`. */
  isWorkingDay: boolean;
  /**
   * Derived "why is this column unavailable" label, or null when the staff
   * member is available (subject to business hours / per-slot bookings).
   * One of "Absent", "Leave", "Inactive", "Week Off" (see `src/lib/attendanceStatus.ts`).
   */
  unavailableLabel: string | null;
  /** True when attendance is HALF_DAY — column is half (not fully) shaded. */
  halfDay: boolean;
};

export type CalendarLine = {
  id: string;
  appointmentId: string;
  appointmentNumber: string | null;
  status: AppointmentStatusValue;
  customerName: string;
  customerMobile: string;
  serviceName: string;
  /** Service's category label (e.g. "Hair", "Spa"), used by the "Colour by: Service category" mode. */
  serviceCategory: string;
  staffId: string | null;
  staffName: string | null;
  /** ISO instants, already resolved in IST for this appointment's running offset. */
  startInstant: string;
  endInstant: string;
  startClock: string;
  endClock: string;
  duration: number;
  price: number;
  sortOrder: number;
  lineIndex: number;
  lineCount: number;
  notes: string | null;
  totalAmount: number;
  totalDuration: number;
  appointmentDate: string;
  appointmentTime: string;
};

export type CalendarBusinessHours = {
  open: string;
  close: string;
  closed: boolean;
  closedReason: string | null;
};

export type CalendarResponse = {
  date: string;
  slotDurationMinutes: number;
  businessHours: CalendarBusinessHours;
  staff: CalendarStaffMember[];
  lines: CalendarLine[];
  salonName: string;
  salonPhone: string | null;
};

export type CalendarAppointmentGroup = {
  appointmentId: string;
  appointmentNumber: string | null;
  status: AppointmentStatusValue;
  customerName: string;
  customerMobile: string;
  notes: string | null;
  totalAmount: number;
  totalDuration: number;
  appointmentDate: string;
  appointmentTime: string;
  lines: CalendarLine[];
};

/** Groups the flat `lines` array back into one entry per appointment, in line/sortOrder. */
export function groupLinesByAppointment(lines: CalendarLine[]): Map<string, CalendarAppointmentGroup> {
  const groups = new Map<string, CalendarAppointmentGroup>();

  for (const line of lines) {
    const existing = groups.get(line.appointmentId);

    if (existing) {
      existing.lines.push(line);
      continue;
    }

    groups.set(line.appointmentId, {
      appointmentId: line.appointmentId,
      appointmentNumber: line.appointmentNumber,
      status: line.status,
      customerName: line.customerName,
      customerMobile: line.customerMobile,
      notes: line.notes,
      totalAmount: line.totalAmount,
      totalDuration: line.totalDuration,
      appointmentDate: line.appointmentDate,
      appointmentTime: line.appointmentTime,
      lines: [line],
    });
  }

  for (const group of groups.values()) {
    group.lines.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return groups;
}
