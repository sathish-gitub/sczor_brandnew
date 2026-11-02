/**
 * Generates the next invoice number for a tenant from its saved prefix and
 * format, scoped by IST period (e.g. year, for formats that reset
 * yearly). Two entry points:
 *
 *  - `resolveNextInvoiceNumber` - used by the invoice-creation transaction.
 *    Takes a Postgres transaction-scoped advisory lock keyed to the exact
 *    prefix/format/period scope being generated, so two simultaneous bills
 *    can never read the same "current max" and produce the same number.
 *    The lock is released automatically when the transaction commits or
 *    rolls back; the DB's `@@unique([invoiceNumber, tenantId])` constraint
 *    remains the final backstop.
 *  - `previewNextInvoiceNumber` - read-only, used by the Tax & Billing
 *    settings page to show "Next invoice: ..." for the prefix/format/start
 *    number currently being edited (not yet saved). No lock is taken since
 *    nothing is being reserved.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_INVOICE_PREFIX,
  buildInvoiceNumber,
  invoiceNumberPattern,
  invoiceNumberPeriod,
  invoiceNumberPrefixScope,
  sanitizeInvoicePrefix,
  type InvoiceNumberFormat,
} from "@/lib/invoiceNumbering";

async function maxExistingSequence(
  client: Pick<Prisma.TransactionClient, "invoice">,
  tenantId: string,
  prefix: string,
  period: string | null,
  startNumber: number,
): Promise<number> {
  const scope = invoiceNumberPrefixScope(prefix, period);
  const pattern = invoiceNumberPattern(prefix, period);

  const existing = await client.invoice.findMany({
    where: { tenantId, invoiceNumber: { startsWith: scope } },
    select: { invoiceNumber: true },
  });

  let maxSequence = Math.max(0, startNumber - 1);
  for (const { invoiceNumber } of existing) {
    const match = pattern.exec(invoiceNumber);
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    if (Number.isFinite(value) && value > maxSequence) {
      maxSequence = value;
    }
  }

  return maxSequence;
}

export async function resolveNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rawPrefix: string | null | undefined,
  format: InvoiceNumberFormat,
  startNumber: number,
  invoiceDate: Date,
): Promise<string> {
  const prefix = sanitizeInvoicePrefix(rawPrefix ?? "") || DEFAULT_INVOICE_PREFIX;
  const period = invoiceNumberPeriod(format, invoiceDate);
  const lockKey = `invoice-number:${tenantId}:${prefix}:${format}:${period ?? "ALL"}`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;

  const maxSequence = await maxExistingSequence(tx, tenantId, prefix, period, startNumber);
  return buildInvoiceNumber(prefix, period, maxSequence + 1);
}

export async function previewNextInvoiceNumber(
  tenantId: string,
  rawPrefix: string | null | undefined,
  format: InvoiceNumberFormat,
  startNumber: number,
): Promise<string> {
  const prefix = sanitizeInvoicePrefix(rawPrefix ?? "") || DEFAULT_INVOICE_PREFIX;
  const period = invoiceNumberPeriod(format, new Date());

  const maxSequence = await maxExistingSequence(prisma, tenantId, prefix, period, startNumber);
  return buildInvoiceNumber(prefix, period, maxSequence + 1);
}
