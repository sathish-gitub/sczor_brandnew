/**
 * Duplicate-safe attendance row lookup.
 *
 * `Attendance` has a `@@unique([staffId, date])` constraint, but `date` is
 * stored as a full instant representing an IST calendar day at 00:00 IST.
 * Older rows could in principle have been written using the host process's
 * local midnight instead (e.g. UTC midnight on a server), which would not
 * match today's IST-midnight instant exactly and would cause a duplicate
 * row to be created instead of the existing one being updated.
 *
 * To stay safe against either convention, attendance writes must look up
 * the existing row for a (staffId, IST calendar day) pair by RANGE
 * (`istDayBounds`) rather than relying on Prisma's `staffId_date` upsert,
 * which only matches the exact stored instant.
 */
import { prisma } from "@/lib/prisma";
import { istDayBounds, startOfDayIST } from "@/lib/time";

/**
 * Finds existing Attendance row ids for the given staff members on the IST
 * calendar day `dateStr`, keyed by staffId. Matches any row whose `date`
 * falls anywhere within that IST day, regardless of the exact instant it
 * was stored with.
 */
export async function findAttendanceIdsForDay(
  tenantId: string,
  staffIds: string[],
  dateStr: string,
): Promise<Map<string, string>> {
  if (staffIds.length === 0) {
    return new Map();
  }

  const { start, end } = istDayBounds(dateStr);
  const rows = await prisma.attendance.findMany({
    where: {
      tenantId,
      staffId: { in: staffIds },
      date: { gte: start, lt: end },
    },
    select: { id: true, staffId: true },
  });

  return new Map(rows.map((row) => [row.staffId, row.id]));
}

/** The canonical instant to store for a new Attendance row for IST calendar day `dateStr`. */
export function attendanceDateInstant(dateStr: string): Date {
  return startOfDayIST(dateStr);
}
