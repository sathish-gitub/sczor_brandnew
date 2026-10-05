/**
 * Idempotent backfill: ensures every distinct Service.category value has a matching
 * ServiceCategory row for its tenant, using the same trimmed, case-insensitive matching
 * rule enforced by the API routes (see src/lib/serviceCategories.ts).
 *
 * Safe to re-run: it only creates missing ServiceCategory rows, it never deletes or
 * renames anything, and it never touches Service rows.
 *
 * Usage: node -r dotenv/config node_modules/.bin/tsx scripts/backfill-service-categories.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  let createdTotal = 0;

  for (const tenant of tenants) {
    const [services, categories] = await Promise.all([
      prisma.service.findMany({
        where: { tenantId: tenant.id },
        distinct: ["category"],
        select: { category: true },
      }),
      prisma.serviceCategory.findMany({
        where: { tenantId: tenant.id },
        select: { name: true },
      }),
    ]);

    const existingLower = new Set(categories.map((category) => category.name.trim().toLowerCase()));

    const missing = services
      .map((service) => service.category.trim())
      .filter((name) => name.length > 0)
      .filter((name) => !existingLower.has(name.toLowerCase()));

    // De-duplicate case-insensitively within the missing set itself, keeping first-seen casing.
    const toCreate = new Map<string, string>();
    for (const name of missing) {
      const key = name.toLowerCase();
      if (!toCreate.has(key)) {
        toCreate.set(key, name);
      }
    }

    if (toCreate.size === 0) {
      console.log(`[${tenant.name}] no missing categories.`);
      continue;
    }

    const created = await prisma.serviceCategory.createMany({
      data: [...toCreate.values()].map((name) => ({ name, tenantId: tenant.id })),
      skipDuplicates: true,
    });

    createdTotal += created.count;
    console.log(`[${tenant.name}] created ${created.count} missing categories:`, [...toCreate.values()]);
  }

  console.log(`\nDone. Created ${createdTotal} ServiceCategory row(s) across ${tenants.length} tenant(s).`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
