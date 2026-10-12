/**
 * ONE-TIME SCRIPT — run manually, not part of normal app flow.
 *
 * Gives a public share token to every existing invoice that doesn't already
 * have one. Safe to re-run (idempotent) — only touches rows where
 * publicToken is null, so running it twice is a no-op the second time.
 *
 * Usage: node -r dotenv/config node_modules/.bin/tsx scripts/backfill-invoice-public-tokens.ts
 */
import { randomBytes } from "crypto";

import { prisma } from "../src/lib/prisma";

const BATCH_SIZE = 200;

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

function generateToken() {
  return randomBytes(24).toString("base64url");
}

async function main() {
  assertLocalDatabase();

  let totalUpdated = 0;

  for (;;) {
    const invoices = await prisma.invoice.findMany({
      where: { publicToken: null },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (invoices.length === 0) {
      break;
    }

    for (const invoice of invoices) {
      // Loop guards against the astronomically unlikely case of a token collision.
      let token = generateToken();
      let attempts = 0;

      while (attempts < 5) {
        const existing = await prisma.invoice.findUnique({
          where: { publicToken: token },
          select: { id: true },
        });

        if (!existing) {
          break;
        }

        token = generateToken();
        attempts += 1;
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { publicToken: token },
      });

      totalUpdated += 1;
    }

    console.log(`Backfilled ${totalUpdated} invoice(s) so far...`);
  }

  console.log(`Done. Backfilled ${totalUpdated} invoice(s) with a publicToken.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
