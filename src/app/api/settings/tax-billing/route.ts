import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INVOICE_PREFIX, INVOICE_NUMBER_FORMATS, sanitizeInvoicePrefix } from "@/lib/invoiceNumbering";

const schema = z.object({
  gstNumber: z.string().optional().or(z.literal("")),
  gstEnabled: z.boolean(),
  gstRate: z.coerce.number().min(0).max(100),
  // Sanitised (trimmed, uppercased, letters/digits/dashes only, max 10
  // chars) below; a blank result falls back to DEFAULT_INVOICE_PREFIX, so
  // no min(1) here - an all-invalid-characters input is not an error.
  invoicePrefix: z.string().max(40),
  invoiceNumberFormat: z.enum(INVOICE_NUMBER_FORMATS),
  invoiceStartNumber: z.coerce.number().int().min(1),
  invoiceFooter: z.string().optional().or(z.literal("")),
  invoiceTerms: z.string().optional().or(z.literal("")),
  currency: z.string().trim().min(3).max(5),
  currencySymbol: z.string().trim().min(1).max(5),
  paymentMethods: z.object({
    cash: z.boolean(),
    upi: z.boolean(),
    card: z.boolean(),
    wallet: z.boolean(),
  }),
  upiId: z.string().optional().or(z.literal("")),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !session.user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Only owner can update billing settings." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;
    // Blank/invalid-characters-only prefixes fall back to the app default;
    // a valid prefix is sanitised (uppercased, letters/digits/dashes only).
    const invoicePrefix = sanitizeInvoicePrefix(data.invoicePrefix) || DEFAULT_INVOICE_PREFIX;

    const enabledCount = [data.paymentMethods.cash, data.paymentMethods.upi, data.paymentMethods.card, data.paymentMethods.wallet].filter(Boolean).length;
    if (enabledCount === 0) {
      return NextResponse.json({ error: "At least one payment method must be enabled." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: session.user.tenantId },
        data: {
          gstNumber: data.gstNumber || null,
        },
      });

      await tx.salonSettings.upsert({
        where: { tenantId: session.user.tenantId },
        create: {
          tenantId: session.user.tenantId,
          gstEnabled: data.gstEnabled,
          gstRate: data.gstRate,
          invoicePrefix,
          invoiceNumberFormat: data.invoiceNumberFormat,
          invoiceStartNumber: data.invoiceStartNumber,
          invoiceFooter: data.invoiceFooter || null,
          invoiceTerms: data.invoiceTerms || null,
          currency: data.currency,
          currencySymbol: data.currencySymbol,
          cashEnabled: data.paymentMethods.cash,
          upiEnabled: data.paymentMethods.upi,
          cardEnabled: data.paymentMethods.card,
          walletEnabled: data.paymentMethods.wallet,
          upiId: data.upiId || null,
        },
        update: {
          gstEnabled: data.gstEnabled,
          gstRate: data.gstRate,
          invoicePrefix,
          invoiceNumberFormat: data.invoiceNumberFormat,
          invoiceStartNumber: data.invoiceStartNumber,
          invoiceFooter: data.invoiceFooter || null,
          invoiceTerms: data.invoiceTerms || null,
          currency: data.currency,
          currencySymbol: data.currencySymbol,
          cashEnabled: data.paymentMethods.cash,
          upiEnabled: data.paymentMethods.upi,
          cardEnabled: data.paymentMethods.card,
          walletEnabled: data.paymentMethods.wallet,
          upiId: data.upiId || null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tax and billing settings", error);
    return NextResponse.json({ error: "Unable to update tax and billing settings right now." }, { status: 500 });
  }
}
