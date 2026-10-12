import { prisma } from "@/lib/prisma";
import { istWallTimeToInstant, todayISTDateString } from "@/lib/time";

export function startOfToday() {
  return istWallTimeToInstant(todayISTDateString(), "00:00");
}

/**
 * Availability is derived state: today's attendance wins, otherwise an in-progress
 * appointment marks the member busy.
 */
export async function syncStaffAvailability(tenantId: string, staffId: string) {
  const attendance = await prisma.attendance.findFirst({
    where: { staffId, tenantId, date: startOfToday() },
    select: { status: true },
  });

  if (attendance && (attendance.status === "ABSENT" || attendance.status === "LEAVE")) {
    await prisma.staff.updateMany({
      where: { id: staffId, tenantId },
      data: { availabilityStatus: "OFF_DUTY" },
    });
    return "OFF_DUTY" as const;
  }

  // A staff member can be assigned to any line of an appointment, not just the first
  // (mirrored) one, so busy-ness is derived from AppointmentService lines.
  const inProgressCount = await prisma.appointmentService.count({
    where: {
      tenantId,
      staffId,
      appointment: {
        status: "IN_PROGRESS",
        appointmentDate: startOfToday(),
      },
    },
  });

  const availabilityStatus = inProgressCount > 0 ? ("BUSY" as const) : ("AVAILABLE" as const);

  await prisma.staff.updateMany({
    where: { id: staffId, tenantId },
    data: { availabilityStatus },
  });

  return availabilityStatus;
}
