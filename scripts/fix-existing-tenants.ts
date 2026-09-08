/**
 * ONE-TIME SCRIPT — run manually, not part of normal app flow.
 *
 * Grandfathers existing tenants that have no plan/trial configured so they
 * are not incorrectly flagged as read-only by the new access-status logic.
 *
 * Usage: npx tsx scripts/fix-existing-tenants.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();
  const subscriptionEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const tenants = await prisma.tenant.findMany({
    where: {
      trialEndsAt: null,
      isSubscribed: false,
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${tenants.length} tenant(s) with no plan configured.`);

  for (const tenant of tenants) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: "MONTHLY",
        isSubscribed: true,
        subscriptionStart: now,
        subscriptionEnd,
      },
    });
    console.log(`Updated tenant "${tenant.name}" (${tenant.id}) -> MONTHLY, subscribed until ${subscriptionEnd.toISOString()}`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
