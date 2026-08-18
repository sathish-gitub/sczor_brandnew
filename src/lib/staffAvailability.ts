import { prisma } from "@/lib/prisma";

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
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

  const inProgressCount = await prisma.appointment.count({
    where: {
      tenantId,
      staffId,
      status: "IN_PROGRESS",
      appointmentDate: startOfToday(),
    },
  });

  const availabilityStatus = inProgressCount > 0 ? ("BUSY" as const) : ("AVAILABLE" as const);

  await prisma.staff.updateMany({
    where: { id: staffId, tenantId },
    data: { availabilityStatus },
  });

  return availabilityStatus;
}
