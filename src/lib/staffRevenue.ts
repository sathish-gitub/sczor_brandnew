/**
 * Shared staff revenue attribution.
 *
 * Revenue is attributed per invoice LINE (InvoiceItem.staffId), not per
 * invoice (Invoice.staffId). Each line's share of the invoice total is
 * proportional to its amount's share of the invoice subtotal, so GST and
 * discount are split the same way as the line prices themselves:
 *
 *   share(line) = (line.amount / subtotal) * invoice.total
 *
 * Lines without a staffId (products, which never carry one, and any
 * historical service line predating per-line staff capture) fall back to
 * the invoice's own staffId mirror. This keeps single-staff invoices
 * numerically identical to the old Invoice.staffId + Invoice.total basis -
 * every line on a single-staff invoice resolves to that same staff member,
 * so the shares still sum to exactly `total` for them. Only invoices with
 * more than one distinct staff member across their lines actually split.
 *
 * Used by: the staff report, payroll commission calculation, the dashboard
 * staffPerformance chart, and the staff detail page's revenue figure - so
 * all four sites share one basis.
 */

import { prisma } from "@/lib/prisma";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type StaffRevenueEntry = {
  revenue: number;
  invoiceIds: Set<string>;
};

/**
 * Attributes PAID invoices in `invoiceDate` range `[gte, lt)` to the given
 * staff members. Omit `range` for an all-time total. Returns a map keyed by
 * staffId; staff with no attributed revenue in range are simply absent from
 * the map.
 */
export async function getStaffRevenueByInvoiceLine(
  tenantId: string,
  staffIds: string[],
  range?: { gte: Date; lt: Date },
): Promise<Map<string, StaffRevenueEntry>> {
  const result = new Map<string, StaffRevenueEntry>();

  if (staffIds.length === 0) {
    return result;
  }

  const staffIdSet = new Set(staffIds);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      paymentStatus: "PAID",
      ...(range ? { invoiceDate: { gte: range.gte, lt: range.lt } } : {}),
      OR: [{ staffId: { in: staffIds } }, { items: { some: { staffId: { in: staffIds } } } }],
    },
    select: {
      id: true,
      total: true,
      staffId: true,
      items: { select: { staffId: true, amount: true } },
    },
  });

  for (const invoice of invoices) {
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    if (subtotal <= 0) {
      continue;
    }

    const total = Number(invoice.total);

    for (const item of invoice.items) {
      const attributedStaffId = item.staffId ?? invoice.staffId;
      if (!attributedStaffId || !staffIdSet.has(attributedStaffId)) {
        continue;
      }

      const share = roundMoney((Number(item.amount) / subtotal) * total);
      const entry = result.get(attributedStaffId) ?? { revenue: 0, invoiceIds: new Set<string>() };
      entry.revenue = roundMoney(entry.revenue + share);
      entry.invoiceIds.add(invoice.id);
      result.set(attributedStaffId, entry);
    }
  }

  return result;
}

/** Convenience wrapper for a single staff member. Omit `range` for an all-time total. */
export async function getStaffRevenue(
  tenantId: string,
  staffId: string,
  range?: { gte: Date; lt: Date },
): Promise<StaffRevenueEntry> {
  const map = await getStaffRevenueByInvoiceLine(tenantId, [staffId], range);
  return map.get(staffId) ?? { revenue: 0, invoiceIds: new Set<string>() };
}

export type ServicesDoneEntry = {
  count: number;
  servicesByName: Record<string, number>;
};

/**
 * Counts AppointmentService lines per staff member - "services done" - so
 * the same person on two lines of one appointment counts twice. Omit
 * `range` for an all-time total. Optionally restrict to appointments of a
 * given status (e.g. "BILLED").
 */
export async function getServicesDoneByStaff(
  tenantId: string,
  staffIds: string[],
  range?: { gte: Date; lt: Date },
  status?: "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "BILLED" | "CANCELLED",
): Promise<Map<string, ServicesDoneEntry>> {
  const result = new Map<string, ServicesDoneEntry>();

  if (staffIds.length === 0) {
    return result;
  }

  const lines = await prisma.appointmentService.findMany({
    where: {
      tenantId,
      staffId: { in: staffIds },
      appointment: {
        ...(range ? { appointmentDate: { gte: range.gte, lt: range.lt } } : {}),
        ...(status ? { status } : {}),
      },
    },
    select: {
      staffId: true,
      service: { select: { name: true } },
    },
  });

  for (const line of lines) {
    if (!line.staffId) {
      continue;
    }

    const entry = result.get(line.staffId) ?? { count: 0, servicesByName: {} };
    entry.count += 1;
    const name = line.service.name;
    entry.servicesByName[name] = (entry.servicesByName[name] ?? 0) + 1;
    result.set(line.staffId, entry);
  }

  return result;
}
