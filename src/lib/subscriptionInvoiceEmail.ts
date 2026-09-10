import { calculateGSTBreakdown } from "@/lib/gst";
import { resend } from "@/lib/resend";

type InvoiceEmailPayment = {
  invoiceNumber: string | null;
  baseAmount: number | null;
  gstAmount: number | null;
  gstRate: number | null;
  amount: number;
  plan: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  razorpayPaymentId: string | null;
  createdAt: Date;
};

type InvoiceEmailTenant = {
  name: string;
  email: string | null;
};

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function formatCurrency(value: number) {
  return `₹${value.toFixed(2)}`;
}

export async function sendSubscriptionInvoiceEmail(payment: InvoiceEmailPayment, tenant: InvoiceEmailTenant) {
  if (!tenant.email) {
    throw new Error("Tenant has no registered email address.");
  }

  const breakdown = calculateGSTBreakdown(payment.amount, payment.gstRate ?? 18);
  const planLabel = payment.plan === "MONTHLY" ? "Monthly" : "Yearly";

  return resend.emails.send({
    from: `sczor <${process.env.RESEND_FROM_EMAIL ?? "noreply@sczor.com"}>`,
    to: tenant.email,
    subject: `sczor Subscription Invoice ${payment.invoiceNumber ?? ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
        <div style="background: #111111; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px;">SCZOR</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0; font-size: 12px; letter-spacing: 1px;">Less Admin. More Glam.</p>
        </div>
        <div style="padding: 32px 24px; color: #333333;">
          <h2 style="margin: 0 0 4px; font-size: 20px;">Payment Receipt</h2>
          <p style="margin: 0 0 24px; font-size: 13px; color: #777777;">Subscription Invoice</p>

          <table style="width: 100%; font-size: 14px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 4px 0; color: #777777;">Invoice Number</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold;">${payment.invoiceNumber ?? "-"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #777777;">Invoice Date</td>
              <td style="padding: 4px 0; text-align: right;">${formatDate(payment.createdAt)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #777777;">Billed To</td>
              <td style="padding: 4px 0; text-align: right;">${tenant.name}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #777777;">Plan</td>
              <td style="padding: 4px 0; text-align: right;">${planLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #777777;">Billing Period</td>
              <td style="padding: 4px 0; text-align: right;">${formatDate(payment.periodStart)} - ${formatDate(payment.periodEnd)}</td>
            </tr>
          </table>

          <table style="width: 100%; font-size: 14px; border-top: 1px solid #eeeeee; border-bottom: 1px solid #eeeeee; padding: 8px 0;">
            <tr>
              <td style="padding: 6px 0; color: #555555;">Subscription Amount</td>
              <td style="padding: 6px 0; text-align: right;">${formatCurrency(breakdown.baseAmount)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555555;">CGST (${(breakdown.gstRate / 2).toFixed(0)}%)</td>
              <td style="padding: 6px 0; text-align: right;">${formatCurrency(breakdown.cgst)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555555;">SGST (${(breakdown.gstRate / 2).toFixed(0)}%)</td>
              <td style="padding: 6px 0; text-align: right;">${formatCurrency(breakdown.sgst)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0 4px; font-weight: bold; font-size: 15px;">Total Paid</td>
              <td style="padding: 10px 0 4px; text-align: right; font-weight: bold; font-size: 15px;">${formatCurrency(breakdown.totalAmount)}</td>
            </tr>
          </table>

          <p style="margin: 20px 0 0; font-size: 13px; color: #777777;">
            Payment Method: Razorpay<br />
            Payment ID: ${payment.razorpayPaymentId ?? "-"}
          </p>

          <p style="margin: 24px 0 0; font-size: 14px;">Thank you for subscribing to sczor!</p>
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="font-size: 12px; color: #999999; margin: 0;">
            Need help? Contact us at connect@droletechnologies.com
          </p>
        </div>
      </div>
    `,
  });
}
