import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewNextInvoiceNumber } from "@/lib/invoiceNumberSequence";
import { INVOICE_NUMBER_FORMATS, type InvoiceNumberFormat } from "@/lib/invoiceNumbering";

/**
 * Read-only "Next invoice: ..." preview for the Tax & Billing settings
 * page. Reflects the prefix/format/start number currently being edited
 * (via query params), not necessarily what's saved yet - nothing is
 * reserved, so this is safe to call on every keystroke.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const prefixParam = url.searchParams.get("prefix");
  const formatParam = url.searchParams.get("format");
  const startNumberParam = url.searchParams.get("startNumber");

  const settings = await prisma.salonSettings.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { invoicePrefix: true, invoiceNumberFormat: true, invoiceStartNumber: true },
  });

  const prefix = prefixParam ?? settings?.invoicePrefix ?? "INV";
  const format: InvoiceNumberFormat = INVOICE_NUMBER_FORMATS.includes(formatParam as InvoiceNumberFormat)
    ? (formatParam as InvoiceNumberFormat)
    : INVOICE_NUMBER_FORMATS.includes(settings?.invoiceNumberFormat as InvoiceNumberFormat)
      ? (settings!.invoiceNumberFormat as InvoiceNumberFormat)
      : "INV-YYYY-XXXX";
  const parsedStartNumber = startNumberParam ? Number(startNumberParam) : NaN;
  const startNumber =
    Number.isFinite(parsedStartNumber) && parsedStartNumber >= 1 ? parsedStartNumber : (settings?.invoiceStartNumber ?? 1);

  try {
    const nextInvoiceNumber = await previewNextInvoiceNumber(session.user.tenantId, prefix, format, startNumber);
    return NextResponse.json({ nextInvoiceNumber });
  } catch (error) {
    console.error("Failed to preview next invoice number", error);
    return NextResponse.json({ error: "Unable to preview the next invoice number." }, { status: 500 });
  }
}
