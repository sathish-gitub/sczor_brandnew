/**
 * Idempotent backfill: ensures every Appointment has at least one
 * AppointmentService line and a non-zero totalAmount.
 *
 * For every Appointment with no lines, creates a single line from its
 * existing serviceId/staffId mirrors:
 *   - price    = the Service's CURRENT price (services don't carry historical
 *                price snapshots pre-migration, so "current price" is the
 *                best available source of truth)
 *   - duration = Appointment.duration (the only duration we have pre-lines)
 *   - sortOrder = 0
 *
 * Appointment.totalAmount is set to that line's price, but only if it is
 * currently 0 (never overwrites an already-set value).
 *
 * Safe to re-run: appointments that already have lines are skipped entirely.
 *
 * Usage: npx tsx scripts/backfill-appointment-services.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let hostname = "";

  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "";
  }

  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  if (!isLocal) {
    console.error(
      `Refusing to run: DATABASE_URL hostname is "${hostname || "unknown"}", not localhost/127.0.0.1. ` +
        "This script is only intended to be run locally. Aborting without making any changes.",
    );
    process.exit(1);
  }
}

async function main() {
  assertLocalDatabase();

  const appointmentsWithoutLines = await prisma.appointment.findMany({
    where: { services: { none: {} } },
    select: {
      id: true,
      serviceId: true,
      staffId: true,
      duration: true,
      totalAmount: true,
      tenantId: true,
      service: { select: { price: true } },
    },
  });

  console.log(`Found ${appointmentsWithoutLines.length} appointment(s) with no lines.`);

  let linesCreated = 0;
  let totalsUpdated = 0;
  let skippedMissingService = 0;

  for (const appointment of appointmentsWithoutLines) {
    if (!appointment.service) {
      // Service was hard-deleted out from under the appointment; nothing to snapshot from.
      skippedMissingService += 1;
      console.warn(`Skipping appointment ${appointment.id}: its service no longer exists.`);
      continue;
    }

    const price = Number(appointment.service.price);

    await prisma.$transaction(async (tx) => {
      await tx.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceId: appointment.serviceId,
          staffId: appointment.staffId,
          price,
          duration: appointment.duration,
          sortOrder: 0,
          tenantId: appointment.tenantId,
        },
      });
      linesCreated += 1;

      if (Number(appointment.totalAmount) === 0) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { totalAmount: price },
        });
        totalsUpdated += 1;
      }
    });
  }

  console.log("Backfill complete.");
  console.log({
    appointmentsScanned: appointmentsWithoutLines.length,
    linesCreated,
    totalsUpdated,
    skippedMissingService,
  });
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
