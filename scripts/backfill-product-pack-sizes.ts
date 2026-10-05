/**
 * ONE-TIME SCRIPT — run manually, not part of normal app flow.
 *
 * Sets a realistic packSize (and corrects legacy unit strings like "bottle"/
 * "jar" to the supported ML/G/L/KG/PCS units) for the Glamour Salon demo
 * tenant's existing products, matched by product name. Safe to re-run
 * (idempotent) — only updates products whose name matches the list below.
 *
 * Usage: node -r dotenv/config node_modules/.bin/tsx scripts/backfill-product-pack-sizes.ts
 */
import { prisma } from "../src/lib/prisma";

const TENANT_SLUG = "glamour-salon-demo";

const PACK_SIZE_BY_NAME: Record<string, { unit: string; packSize: number | null }> = {
  "Shampoo 250ml": { unit: "ml", packSize: 250 },
  "Conditioner 250ml": { unit: "ml", packSize: 250 },
  "Hair Serum 100ml": { unit: "ml", packSize: 100 },
  "Hair Oil 200ml": { unit: "ml", packSize: 200 },
  "Keratin Treatment Kit": { unit: "pcs", packSize: null },
  "Hair Mask 200g": { unit: "g", packSize: 200 },
  "Face Wash 100ml": { unit: "ml", packSize: 100 },
  "Moisturizer 200g": { unit: "g", packSize: 200 },
  "Sunscreen SPF50 100ml": { unit: "ml", packSize: 100 },
  "Face Pack 100g": { unit: "g", packSize: 100 },
  "Under Eye Cream 30g": { unit: "g", packSize: 30 },
  "Nail Polish (assorted)": { unit: "pcs", packSize: null },
  "Nail Polish Remover 200ml": { unit: "ml", packSize: 200 },
  "Cuticle Oil 30ml": { unit: "ml", packSize: 30 },
  "Nail Art Stickers Pack": { unit: "pcs", packSize: null },
  "Hair Dryer (Professional)": { unit: "pcs", packSize: null },
  "Hair Straightener": { unit: "pcs", packSize: null },
  "Trimmer Kit": { unit: "pcs", packSize: null },
  "Disposable Towels (Pack of 50)": { unit: "pcs", packSize: null },
  "Salon Gift Hamper": { unit: "pcs", packSize: null },
};

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG }, select: { id: true, name: true } });

  if (!tenant) {
    console.log(`No tenant found with slug "${TENANT_SLUG}". Nothing to do.`);
    return;
  }

  console.log(`Found demo tenant "${tenant.name}" (${tenant.id}).`);

  let updated = 0;

  for (const [name, { unit, packSize }] of Object.entries(PACK_SIZE_BY_NAME)) {
    const result = await prisma.product.updateMany({
      where: { tenantId: tenant.id, name },
      data: { unit, packSize },
    });

    if (result.count > 0) {
      updated += result.count;
      console.log(`Updated "${name}" -> unit=${unit}, packSize=${packSize ?? "null"} (${result.count} row(s))`);
    } else {
      console.log(`No match for "${name}" — skipped.`);
    }
  }

  console.log(`Done. Updated ${updated} product(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
