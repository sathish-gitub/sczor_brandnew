import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessHoursForDate } from "@/lib/businessHours";
import { addMinutesToClock, instantForOffset, istDayBounds, istWallTimeToInstant, toISTWeekday } from "@/lib/time";
import type { CalendarAttendanceStatus, CalendarLine, CalendarResponse, CalendarStaffMember } from "@/lib/calendarTypes";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  // "ALL" (or an empty string) means "no staff filter" — normalize both to
  // null so a stray ?staffId=ALL (never produced by the UI, which omits the
  // param instead, but possible via a hand-typed/bookmarked URL) does not
  // get treated as a literal staff ID that matches nothing.
  const rawStaffParam = url.searchParams.get("staffId");
  const staffParam = rawStaffParam && rawStaffParam !== "ALL" ? rawStaffParam : null;

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  try {
    // Sequential Prisma calls throughout this handler (never Promise.all): a
    // connection-pool race has previously surfaced when several concurrent
    // queries were fired from one request.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, phone: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const businessHours = await getBusinessHoursForDate({ tenantId, dateStr: dateParam });

    const { start, end } = istDayBounds(dateParam);
    const weekday = toISTWeekday(istWallTimeToInstant(dateParam, "00:00"));
    // Attendance rows may have been written as either the IST-midnight instant
    // (current convention, see src/lib/attendanceDate.ts) or a legacy
    // UTC-midnight instant for this date string, so match by a range wide
    // enough to cover both rather than an exact instant.
    const utcMidnight = new Date(`${dateParam}T00:00:00.000Z`);
    const attendanceRangeStart = new Date(Math.min(start.getTime(), utcMidnight.getTime()));
    const attendanceRangeEnd = new Date(Math.max(end.getTime(), utcMidnight.getTime() + 24 * 60 * 60 * 1000));

    const staffWhere =
      staffParam && staffParam !== "unassigned"
        ? { tenantId, id: staffParam }
        : { tenantId, status: "ACTIVE" as const };

    const staffRows =
      staffParam === "unassigned"
        ? []
        : await prisma.staff.findMany({
            where: staffWhere,
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              designation: true,
              status: true,
              workingDays: true,
              attendances: {
                where: { date: { gte: attendanceRangeStart, lt: attendanceRangeEnd } },
                select: { status: true },
                take: 1,
              },
            },
          });

    const staff: CalendarStaffMember[] = staffRows.map((member) => {
      const attendanceStatus = (member.attendances[0]?.status ?? null) as CalendarAttendanceStatus;
      const isWorkingDay = member.workingDays.includes(weekday);
      const halfDay = attendanceStatus === "HALF_DAY";

      let unavailableLabel: string | null = null;
      if (member.status !== "ACTIVE") {
        unavailableLabel = "Inactive";
      } else if (attendanceStatus === "ABSENT") {
        unavailableLabel = "Absent";
      } else if (attendanceStatus === "LEAVE") {
        unavailableLabel = "On Leave";
      } else if (halfDay) {
        // Half-day attendance has no AM/PM granularity in the schema, so the
        // whole column is marked with a lighter "Half Day" overlay (see
        // `column.halfDay` in CalendarGrid) rather than a full block-out.
        unavailableLabel = "Half Day";
      } else if (!isWorkingDay) {
        unavailableLabel = "Off today";
      }

      return {
        id: member.id,
        name: member.name,
        designation: member.designation,
        status: member.status,
        attendanceStatus,
        isWorkingDay,
        unavailableLabel,
        halfDay,
      };
    });

    // Predicate applied to the computed `lines` array (not the Prisma query
    // — see comment below) so offsets stay correct for the whole appointment.
    const matchesStaffFilter = (staffId: string | null): boolean => {
      if (staffParam === "unassigned") return staffId === null;
      if (staffParam) return staffId === staffParam;
      return true;
    };

    // Fetch every line of every appointment on this day (tenant-scoped, with
    // no staff filter applied yet) so each line's running offset, lineIndex
    // and lineCount are computed from the appointment's *complete* service
    // list. Filtering by staffId here instead would silently drop sibling
    // lines (e.g. a different staff member's line) from the offset
    // calculation and produce wrong start/end times for later lines in a
    // multi-staff appointment. The staff filter is applied afterwards, to
    // the computed `lines` array only.
    const serviceLines = await prisma.appointmentService.findMany({
      where: {
        tenantId,
        appointment: { appointmentDate: { gte: start, lt: end } },
      },
      orderBy: [{ appointmentId: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        appointmentId: true,
        staffId: true,
        duration: true,
        price: true,
        sortOrder: true,
        service: { select: { name: true, category: true } },
        staff: { select: { id: true, name: true } },
        appointment: {
          select: {
            appointmentNumber: true,
            appointmentTime: true,
            appointmentDate: true,
            status: true,
            notes: true,
            totalAmount: true,
            duration: true,
            customer: { select: { name: true, mobile: true } },
          },
        },
      },
    });

    const byAppointment = new Map<string, typeof serviceLines>();
    for (const line of serviceLines) {
      const list = byAppointment.get(line.appointmentId);
      if (list) {
        list.push(line);
      } else {
        byAppointment.set(line.appointmentId, [line]);
      }
    }

    const lines: CalendarLine[] = [];

    for (const [appointmentId, linesForAppointment] of byAppointment) {
      const sorted = [...linesForAppointment].sort((a, b) => a.sortOrder - b.sortOrder);
      let offset = 0;
      const lineCount = sorted.length;

      sorted.forEach((line, index) => {
        const { appointmentTime, appointmentDate } = line.appointment;
        const startInstant = instantForOffset(appointmentDate, appointmentTime, offset);
        const endInstant = instantForOffset(appointmentDate, appointmentTime, offset + line.duration);

        lines.push({
          id: line.id,
          appointmentId,
          appointmentNumber: line.appointment.appointmentNumber,
          status: line.appointment.status,
          customerName: line.appointment.customer.name,
          customerMobile: line.appointment.customer.mobile,
          serviceName: line.service.name,
          serviceCategory: line.service.category,
          staffId: line.staffId,
          staffName: line.staff?.name ?? null,
          startInstant: startInstant.toISOString(),
          endInstant: endInstant.toISOString(),
          startClock: addMinutesToClock(appointmentTime, offset),
          endClock: addMinutesToClock(appointmentTime, offset + line.duration),
          duration: line.duration,
          price: Number(line.price),
          sortOrder: line.sortOrder,
          lineIndex: index + 1,
          lineCount,
          notes: line.appointment.notes,
          totalAmount: Number(line.appointment.totalAmount),
          totalDuration: line.appointment.duration,
          appointmentDate: appointmentDate.toISOString(),
          appointmentTime,
        });

        offset += line.duration;
      });
    }

    // Filter down to the requested staff *after* every line's offset was
    // computed against its appointment's complete, unfiltered service list.
    const filteredLines = lines.filter((line) => matchesStaffFilter(line.staffId));
    filteredLines.sort((a, b) => new Date(a.startInstant).getTime() - new Date(b.startInstant).getTime());

    const response: CalendarResponse = {
      date: dateParam,
      slotDurationMinutes: 30,
      businessHours,
      staff,
      lines: filteredLines,
      salonName: tenant.name,
      salonPhone: tenant.phone,
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load calendar", error);
    return NextResponse.json({ error: "Unable to load the day view calendar." }, { status: 500 });
  }
}
