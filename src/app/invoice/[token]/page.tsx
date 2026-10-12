import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoicePrint } from "@/components/billing/InvoicePrint";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Invoice",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invoice = token
    ? await prisma.invoice.findUnique({
        where: { publicToken: token },
        include: {
          tenant: {
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
              instagramUrl: true,
              googleReviewUrl: true,
            },
          },
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
          appointment: {
            select: {
              appointmentDate: true,
              appointmentTime: true,
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
      })
    : null;

  if (!invoice) {
    notFound();
  }

  const loyaltyDiscount = invoice.loyaltyTxns
    .filter((item) => item.type === "REDEEMED")
    .reduce((sum, item) => sum + item.points, 0);

  const pointsEarned = invoice.loyaltyTxns
    .filter((item) => item.type === "EARNED")
    .reduce((sum, item) => sum + item.points, 0);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <InvoicePrint
        variant="public"
        tenant={invoice.tenant}
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
          publicToken: invoice.publicToken,
          appointment: invoice.appointment
            ? {
                appointmentDate: invoice.appointment.appointmentDate.toISOString(),
                appointmentTime: invoice.appointment.appointmentTime,
              }
            : null,
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
    </main>
  );
}
