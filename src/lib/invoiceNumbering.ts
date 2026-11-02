/**
 * Pure helpers shared by the Tax & Billing settings UI, its API route, and
 * the invoice-number sequence generator (`invoiceNumberSequence.ts`). Kept
 * free of any Prisma/server-only imports so the settings page (a client
 * component) can use the same sanitisation and formatting rules the server
 * enforces - the two can never drift apart.
 */

import { getISTYear } from "@/lib/time";

/** Fallback used whenever a tenant's configured prefix sanitises to "". */
export const DEFAULT_INVOICE_PREFIX = "INV";

export const INVOICE_NUMBER_FORMATS = ["INV-YYYY-XXXX", "INV-XXXX"] as const;
export type InvoiceNumberFormat = (typeof INVOICE_NUMBER_FORMATS)[number];

export const INVOICE_NUMBER_FORMAT_LABELS: Record<InvoiceNumberFormat, string> = {
  "INV-YYYY-XXXX": "INV-YYYY-XXXX (prefix + year + sequence)",
  "INV-XXXX": "INV-XXXX (prefix + sequence)",
};

const SEQUENCE_WIDTH = 4;

/**
 * Trims whitespace, uppercases letters, and strips everything except
 * A-Z, 0-9 and dashes, capped at 10 characters. Returns "" when nothing
 * valid remains - callers should fall back to DEFAULT_INVOICE_PREFIX.
 */
export function sanitizeInvoicePrefix(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 10);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The "period" component of an invoice number for a given format, derived
 * from the IST invoice date (never the server clock). Formats with no
 * period (a flat running sequence) return null.
 */
export function invoiceNumberPeriod(format: InvoiceNumberFormat, invoiceDate: Date): string | null {
  switch (format) {
    case "INV-YYYY-XXXX":
      return String(getISTYear(invoiceDate));
    case "INV-XXXX":
      return null;
    default:
      return null;
  }
}

/** Builds the invoice number text for a resolved sequence value. */
export function buildInvoiceNumber(prefix: string, period: string | null, sequence: number): string {
  const paddedSequence = String(sequence).padStart(SEQUENCE_WIDTH, "0");
  return period ? `${prefix}-${period}-${paddedSequence}` : `${prefix}-${paddedSequence}`;
}

/**
 * Matches invoice numbers previously generated for this exact
 * prefix/period combination, capturing the sequence digits. Scoping the
 * match this tightly means a format or prefix change can never be
 * confused with (or collide with) numbers generated under a different
 * shape - each scope keeps its own independent sequence.
 */
export function invoiceNumberPattern(prefix: string, period: string | null): RegExp {
  const escapedPrefix = escapeRegExp(prefix);
  return period
    ? new RegExp(`^${escapedPrefix}-${escapeRegExp(period)}-(\\d+)$`)
    : new RegExp(`^${escapedPrefix}-(\\d+)$`);
}

/** The DB `startsWith` scope matching the pattern above, for a narrow pre-filter query. */
export function invoiceNumberPrefixScope(prefix: string, period: string | null): string {
  return period ? `${prefix}-${period}-` : `${prefix}-`;
}
