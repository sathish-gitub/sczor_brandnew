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
    }>;
    pointsEarned: number;
  };
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

export function InvoicePrint({ invoice }: InvoicePrintProps) {
  const cgst = invoice.taxAmount / 2;
  const sgst = invoice.taxAmount / 2;

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <Image
              src="/images/sczor_logo_dark.png"
              alt="sczor"
              width={120}
              height={40}
              priority
            />
            <p className="text-xs text-[var(--muted)]">Less Admin. More Glam.</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--foreground)]">Invoice #{invoice.invoiceNumber}</p>
            <p className="text-xs text-[var(--muted)]">{formatDate(invoice.invoiceDate)}</p>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-[var(--border)]" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bill To</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{invoice.customer.name}</p>
            <p className="text-sm text-[var(--muted)]">+91 {invoice.customer.mobile}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Payment</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{invoice.paymentMethod}</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Service</th>
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
