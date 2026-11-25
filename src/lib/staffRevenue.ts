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

export type ServicesDoneByInvoiceLineEntry = {
  count: number;
  servicesByName: Record<string, number>;
  invoiceIds: Set<string>;
};

/**
 * POS-only "services done": counts InvoiceItem rows that are services
 * (serviceId set, productId not set) on invoices dated in `invoiceDate`
 * range `[gte, lt)`, excluding CANCELLED/REFUNDED invoices. Credited to
 * InvoiceItem.staffId, falling back to Invoice.staffId for lines that
 * predate per-line attribution (same basis as revenue). The same staff
 * member on two lines of one invoice counts 2. `invoiceIds` is the set of
 * distinct invoices on which the staff member has at least one such line,
 * used for the staff report's invoice count. Omit `range` for an all-time
 * total.
 *
 * Used by: the staff performance report only.
 */
export async function getServicesDoneByInvoiceLine(
  tenantId: string,
  staffIds: string[],
  range?: { gte: Date; lt: Date },
): Promise<Map<string, ServicesDoneByInvoiceLineEntry>> {
  const result = new Map<string, ServicesDoneByInvoiceLineEntry>();

  if (staffIds.length === 0) {
    return result;
  }

  const staffIdSet = new Set(staffIds);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      paymentStatus: { notIn: ["CANCELLED", "REFUNDED"] },
      ...(range ? { invoiceDate: { gte: range.gte, lt: range.lt } } : {}),
      OR: [
        { staffId: { in: staffIds } },
        { items: { some: { staffId: { in: staffIds }, serviceId: { not: null }, productId: null } } },
      ],
    },
    select: {
      id: true,
      staffId: true,
      items: {
        select: {
          staffId: true,
          serviceId: true,
          productId: true,
          service: { select: { name: true } },
        },
      },
    },
  });

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      if (!item.serviceId || item.productId) {
        continue;
      }

      const attributedStaffId = item.staffId ?? invoice.staffId;
      if (!attributedStaffId || !staffIdSet.has(attributedStaffId)) {
        continue;
      }

      const entry = result.get(attributedStaffId) ?? { count: 0, servicesByName: {}, invoiceIds: new Set<string>() };
      entry.count += 1;
      const name = item.service?.name ?? "Service";
      entry.servicesByName[name] = (entry.servicesByName[name] ?? 0) + 1;
      entry.invoiceIds.add(invoice.id);
      result.set(attributedStaffId, entry);
    }
  }

  return result;
}

export type StaffCategoryBreakdownEntry = {
  category: string;
  count: number;
  revenue: number;
};

export type StaffCategoryBreakdown = {
  entries: StaffCategoryBreakdownEntry[];
  totalCount: number;
  totalRevenue: number;
};

/**
 * Per-category breakdown of POS "services done" and revenue for ONE staff
 * member, for the staff profile Performance tab. Same billing basis as
 * `getServicesDoneByInvoiceLine` (service lines on non-cancelled/refunded
 * invoices, credited to InvoiceItem.staffId falling back to Invoice.staffId)
 * and the same per-line revenue share formula as
 * `getStaffRevenueByInvoiceLine` (share = line.amount / subtotal * total),
 * without calling or changing either function. Category is the Service's
 * `category` text, matched case-insensitively against the tenant's
 * ServiceCategory names and normalised to the stored name; lines whose
 * service no longer exists or has no category fall under "Uncategorised".
 * Single query set (no Promise.all) - the category list, then one invoice
 * query, both scoped to this staff member and the optional range.
 */
export async function getStaffServiceCategoryBreakdown(
  tenantId: string,
  staffId: string,
  range?: { gte: Date; lt: Date },
): Promise<StaffCategoryBreakdown> {
  const categories = await prisma.serviceCategory.findMany({
    where: { tenantId },
    select: { name: true },
  });
  const categoryByLowerName = new Map(categories.map((entry) => [entry.name.toLowerCase(), entry.name]));

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      paymentStatus: { notIn: ["CANCELLED", "REFUNDED"] },
      ...(range ? { invoiceDate: { gte: range.gte, lt: range.lt } } : {}),
      OR: [
        { staffId },
        { items: { some: { staffId, serviceId: { not: null }, productId: null } } },
      ],
    },
    select: {
      staffId: true,
      total: true,
      items: {
        select: {
          staffId: true,
          serviceId: true,
          productId: true,
          amount: true,
          service: { select: { category: true } },
        },
      },
    },
  });

  const byCategory = new Map<string, { count: number; revenue: number }>();

  for (const invoice of invoices) {
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    if (subtotal <= 0) {
      continue;
    }

    const total = Number(invoice.total);

    for (const item of invoice.items) {
      if (!item.serviceId || item.productId) {
        continue;
      }

      const attributedStaffId = item.staffId ?? invoice.staffId;
      if (attributedStaffId !== staffId) {
        continue;
      }

      const rawCategory = item.service?.category?.trim();
      const category = rawCategory
        ? categoryByLowerName.get(rawCategory.toLowerCase()) ?? rawCategory
        : "Uncategorised";

      const share = roundMoney((Number(item.amount) / subtotal) * total);
      const entry = byCategory.get(category) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue = roundMoney(entry.revenue + share);
      byCategory.set(category, entry);
    }
  }

  const entries = Array.from(byCategory.entries())
    .map(([category, value]) => ({ category, count: value.count, revenue: value.revenue }))
    .sort((a, b) => b.count - a.count);

  const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);
  const totalRevenue = roundMoney(entries.reduce((sum, entry) => sum + entry.revenue, 0));

  return { entries, totalCount, totalRevenue };
}
