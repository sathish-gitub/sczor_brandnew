import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { InvoicePrint } from "@/components/billing/InvoicePrint";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  const [invoice, tenant] = await Promise.all([
    prisma.invoice.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        customer: {
          select: {
            name: true,
            mobile: true,
            loyaltyCard: {
              select: {
                totalPoints: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            name: true,
            price: true,
            quantity: true,
            amount: true,
            staff: {
              select: {
                name: true,
              },
            },
          },
        },
        loyaltyTxns: {
          select: {
            type: true,
            points: true,
          },
        },
      },
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        logo: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
        gstNumber: true,
      },
    }),
  ]);

  if (!invoice || !tenant) {
    notFound();
  }

  const loyaltyDiscount = invoice.loyaltyTxns
    .filter((item) => item.type === "REDEEMED")
    .reduce((sum, item) => sum + item.points, 0);

  const pointsEarned = invoice.loyaltyTxns
    .filter((item) => item.type === "EARNED")
    .reduce((sum, item) => sum + item.points, 0);

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-[var(--border)] bg-white px-5 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Invoice {invoice.invoiceNumber}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review, print, and share invoice details.</p>
      </header>

      <InvoicePrint
        tenant={tenant}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString(),
          subtotal: Number(invoice.subtotal),
          discount: Number(invoice.discount),
          loyaltyDiscount,
          taxAmount: Number(invoice.taxAmount),
          total: Number(invoice.total),
          paymentMethod: invoice.paymentMethod,
          paymentStatus: invoice.paymentStatus,
          customer: {
            name: invoice.customer.name,
            mobile: invoice.customer.mobile,
            totalPoints: invoice.customer.loyaltyCard?.totalPoints ?? 0,
          },
          items: invoice.items.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price),
            quantity: item.quantity,
            amount: Number(item.amount),
            staffName: item.staff?.name ?? null,
          })),
          pointsEarned,
        }}
      />
    </div>
  );
}
