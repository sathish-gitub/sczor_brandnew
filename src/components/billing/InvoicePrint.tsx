"use client";

import Image from "next/image";
import Link from "next/link";

type InvoicePrintProps = {
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    subtotal: number;
    discount: number;
    loyaltyDiscount: number;
    taxAmount: number;
    total: number;
    paymentMethod: string;
    paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
    customer: {
      name: string;
      mobile: string;
      totalPoints: number;
    };
    items: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      amount: number;
      staffName: string | null;
    }>;
    pointsEarned: number;
  };
  tenant: {
    name: string;
    logo: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    gstNumber: string | null;
  };
};

const paymentStatusStyles: Record<string, string> = {
  PAID: "border-emerald-200 bg-emerald-100 text-emerald-700",
  REFUNDED: "border-orange-200 bg-orange-100 text-orange-700",
  CANCELLED: "border-red-200 bg-red-100 text-red-700",
  PENDING: "border-amber-200 bg-amber-100 text-amber-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function InvoicePrint({ invoice, tenant }: InvoicePrintProps) {
  const cgst = invoice.taxAmount / 2;
  const sgst = invoice.taxAmount / 2;
  const locationLine = [[tenant.city, tenant.state].filter(Boolean).join(", "), tenant.pincode]
    .filter(Boolean)
    .join(" - ");
  const contactLine = [tenant.phone, tenant.email].filter(Boolean).join(" | ");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Download PDF
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Invoice ${invoice.invoiceNumber} for ${invoice.customer.name}, Amount ${formatCurrency(invoice.total)}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Send WhatsApp
        </a>
        <Link
          href="/billing/invoices"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Back
        </Link>
      </div>

      <article className="print-area mx-auto max-w-3xl rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {tenant.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logo}
                alt={tenant.name}
                className="h-16 w-16 rounded-xl object-contain"
              />
            ) : null}
            <div>
              <p className="text-xl font-bold tracking-tight text-[var(--foreground)]">{tenant.name}</p>
              {tenant.address ? <p className="text-sm text-[var(--muted)]">{tenant.address}</p> : null}
              {locationLine ? <p className="text-sm text-[var(--muted)]">{locationLine}</p> : null}
              {contactLine ? <p className="text-sm text-[var(--muted)]">{contactLine}</p> : null}
              {tenant.gstNumber ? (
                <p className="text-sm font-medium text-[var(--foreground)]">GST: {tenant.gstNumber}</p>
              ) : null}
            </div>
          </div>

          <span
            className={[
              "inline-flex h-8 items-center self-start rounded-full border px-4 text-sm font-bold uppercase tracking-[0.08em]",
              paymentStatusStyles[invoice.paymentStatus] ?? paymentStatusStyles.PENDING,
            ].join(" ")}
          >
            {invoice.paymentStatus}
          </span>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <div className="grid gap-1 text-sm">
          <p className="text-base font-semibold text-[var(--foreground)]">INVOICE #{invoice.invoiceNumber}</p>
          <p className="text-[var(--muted)]">Date: {formatDate(invoice.invoiceDate)}</p>
          <p className="text-[var(--muted)]">Payment: {invoice.paymentMethod}</p>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bill To</p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{invoice.customer.name}</p>
          <p className="text-sm text-[var(--muted)]">+91 {invoice.customer.mobile}</p>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Service</th>
                <th className="py-2">Staff</th>
                <th className="py-2">Price</th>
                <th className="py-2">Qty</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="py-2">{index + 1}</td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.staffName ?? "—"}</td>
                  <td className="py-2">{formatCurrency(item.price)}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <p className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></p>
          <p className="flex justify-between"><span className="text-[var(--muted)]">CGST (9%)</span><span>{formatCurrency(cgst)}</span></p>
          <p className="flex justify-between"><span className="text-[var(--muted)]">SGST (9%)</span><span>{formatCurrency(sgst)}</span></p>
          <p className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><span>-{formatCurrency(invoice.discount)}</span></p>
          <p className="flex justify-between"><span className="text-[var(--muted)]">Loyalty Discount</span><span>-{formatCurrency(invoice.loyaltyDiscount)}</span></p>
          <p className="mt-2 flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </p>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <p className="text-sm text-[var(--foreground)]">Points earned: {invoice.pointsEarned}</p>
        <p className="text-sm text-[var(--foreground)]">Total balance: {invoice.customer.totalPoints} points</p>

        <div className="mt-5 flex flex-col items-center gap-2 text-center text-xs text-[var(--muted)]">
          <p>Thank you for visiting.</p>
          <Image
            src="/images/sczor_logo_dark.png"
            alt="sczor"
            width={84}
            height={28}
          />
        </div>
      </article>
    </div>
  );
}
