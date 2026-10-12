import { AppointmentConflictError } from "@/lib/appointmentServicePayload";
import { prisma } from "@/lib/prisma";
import { addMinutesToClock, formatClockTime12Hour, instantForOffset, istDayBounds } from "@/lib/time";

export type StaffLineWindow = {
  appointmentId: string;
  staffId: string;
  /** "HH:mm" wall-clock labels, for display purposes ("Busy 11:00 AM to 11:45 AM"). */
  startClock: string;
  endClock: string;
  /** Absolute instants, for correct overlap comparisons (handles midnight rollover). */
  startInstant: Date;
  endInstant: Date;
};

/**
 * Loads every staffed AppointmentService line for non-cancelled appointments
 * that fall on the given IST calendar date, resolving each line's
 * back-to-back offset within its own appointment. Used both for conflict
 * checks on write and for "busy window" displays in the booking form.
 */
export async function loadStaffLineWindowsForDate({
  tenantId,
  dateStr,
  excludeAppointmentId,
}: {
  tenantId: string;
  dateStr: string;
  excludeAppointmentId?: string;
}): Promise<StaffLineWindow[]> {
  const { start, end } = istDayBounds(dateStr);

  const lines = await prisma.appointmentService.findMany({
    where: {
      tenantId,
      appointment: {
        appointmentDate: { gte: start, lt: end },
        status: { not: "CANCELLED" },
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      },
    },
    select: {
      appointmentId: true,
      staffId: true,
      duration: true,
      sortOrder: true,
      appointment: { select: { appointmentTime: true, appointmentDate: true } },
    },
  });

  const byAppointment = new Map<string, typeof lines>();

  for (const line of lines) {
    const list = byAppointment.get(line.appointmentId);
    if (list) {
      list.push(line);
    } else {
      byAppointment.set(line.appointmentId, [line]);
    }
  }

  const windows: StaffLineWindow[] = [];

  for (const [appointmentId, linesForAppointment] of byAppointment) {
    const sorted = [...linesForAppointment].sort((a, b) => a.sortOrder - b.sortOrder);
    let offset = 0;

    for (const line of sorted) {
      if (line.staffId) {
        const { appointmentTime, appointmentDate } = line.appointment;

        windows.push({
          appointmentId,
          staffId: line.staffId,
          startClock: addMinutesToClock(appointmentTime, offset),
          endClock: addMinutesToClock(appointmentTime, offset + line.duration),
          startInstant: instantForOffset(appointmentDate, appointmentTime, offset),
          endInstant: instantForOffset(appointmentDate, appointmentTime, offset + line.duration),
        });
      }

      offset += line.duration;
    }
  }

  return windows;
}

export type CandidateLine = {
  serviceId: string;
  staffId: string | null;
  duration: number;
};

/**
 * Validates that none of the candidate lines' staff members overlap with any
 * OTHER appointment's staffed lines that day. Lines within the same request
 * never conflict with each other (they're never compared against one
 * another, only against `existingWindows` loaded from other appointments).
 */
export function assertNoStaffConflicts({
  appointmentDate,
  appointmentTime,
  lines,
  existingWindows,
  staffNameById,
}: {
  appointmentDate: Date;
  appointmentTime: string;
  lines: CandidateLine[];
  existingWindows: StaffLineWindow[];
  staffNameById: Map<string, string>;
}) {
  let offset = 0;

  for (const line of lines) {
    if (!line.staffId) {
      offset += line.duration;
      continue;
    }

    const lineStart = instantForOffset(appointmentDate, appointmentTime, offset);
    const lineEnd = instantForOffset(appointmentDate, appointmentTime, offset + line.duration);

    const conflict = existingWindows.find(
      (window) =>
        window.staffId === line.staffId && window.startInstant < lineEnd && lineStart < window.endInstant,
    );

    if (conflict) {
      const name = staffNameById.get(line.staffId) ?? "This staff member";
      throw new AppointmentConflictError(
        `${name} is already booked from ${formatClockTime12Hour(conflict.startClock)} to ` +
          `${formatClockTime12Hour(conflict.endClock)} and is not available for the selected time.`,
      );
    }

    offset += line.duration;
  }
}
