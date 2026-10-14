/**
 * Export smoke test — run with `npm run test:export` (no browser, no DOM, no dev server).
 *
 * Builds Excel workbooks directly via `buildExcelWorkbook` (the workbook-building half of
 * `exportToExcel`, split out specifically so it can be exercised headlessly) for a battery of
 * configs: every column type, a minimal config, a config with summary/totals/extraSections,
 * a zero-row config, and one config shaped like each real report page's export config. Any
 * exception thrown while building a workbook fails the test immediately. Every produced buffer
 * is then reloaded with ExcelJS and checked for a header row matching the configured column
 * headers and a sane row count.
 *
 * Usage: npm run test:export
 */
import ExcelJS from "exceljs";

import { buildExcelWorkbook, type ExportConfig } from "../src/lib/exportReport";

type TestCase = {
  name: string;
  config: ExportConfig;
};

const SALON = {
  name: "Test Salon",
  logo: null,
  address: "12 MG Road",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
  phone: "9876543210",
  email: "hello@salon.test",
  gstNumber: "33ABCDE1234F1Z5",
};

const cases: TestCase[] = [];

// ---- 1. Every column type (plus a missing-type and an unknown/typo'd-type column) ----
cases.push({
  name: "every column type (+ missing/unknown type)",
  config: {
    title: "Every Column Type",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "None",
    generatedBy: "Test User",
    summary: [
      { label: "Text Summary", value: "OK", type: "text" },
      { label: "Number Summary", value: 42, type: "number" },
      { label: "Currency Summary", value: 1234.5, type: "currency" },
      { label: "Percent Summary", value: 12.5, type: "percent" },
      // Deliberately no `type` — must default to text/left, not throw.
      { label: "Untyped Summary", value: "fallback" },
    ],
    columns: [
      { header: "Text Col", key: "text", type: "text" },
      { header: "Number Col", key: "number", type: "number" },
      { header: "Currency Col", key: "currency", type: "currency" },
      { header: "Date Col", key: "date", type: "date" },
      { header: "Percent Col", key: "percent", type: "percent" },
      // Deliberately no `type` at all.
      { header: "Untyped Col", key: "untyped" },
      // Deliberately an invalid/typo'd type string (cast through `as` to bypass the TS union
      // since this simulates a real-world mistake a report page author could make at runtime).
      { header: "Bogus Type Col", key: "bogus", type: "curreny" as ExportConfig["columns"][number]["type"] },
    ],
    rows: [
      { text: "Alpha", number: 10, currency: 100.5, date: "2026-10-05", percent: 25, untyped: "x", bogus: 5 },
      { text: "Beta", number: 20, currency: 200.75, date: "2026-10-06", percent: 50, untyped: "y", bogus: 6 },
    ],
    totals: { text: "Total", number: 30, currency: 301.25, percent: 37.5 },
    filename: "test-every-column-type",
  },
});

// ---- 2. Minimal config: only title, columns, rows ----
cases.push({
  name: "minimal config (title, columns, rows only)",
  config: {
    title: "Minimal Report",
    columns: [
      { header: "Name", key: "name", type: "text" },
      { header: "Count", key: "count", type: "number" },
    ],
    rows: [
      { name: "Row A", count: 1 },
      { name: "Row B", count: 2 },
    ],
    filename: "test-minimal",
  } as ExportConfig,
});

// ---- 3. Summary + totals + extraSections ----
cases.push({
  name: "summary + totals + extraSections",
  config: {
    title: "Full Featured Report",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "Staff - Priya, Status - Paid",
    generatedBy: "Owner",
    summary: [
      { label: "Total Revenue", value: 50000, type: "currency" },
      { label: "Invoices", value: 120, type: "number" },
    ],
    columns: [
      { header: "Date", key: "date", type: "date" },
      { header: "Revenue", key: "revenue", type: "currency" },
      { header: "Invoices", key: "invoices", type: "number" },
    ],
    rows: [
      { date: "2026-10-01", revenue: 1000, invoices: 5 },
      { date: "2026-10-02", revenue: 2000, invoices: 7 },
    ],
    totals: { date: "Total", revenue: 3000, invoices: 12 },
    extraSections: [
      {
        title: "By Staff",
        columns: [
          { header: "Staff", key: "staff", type: "text" },
          { header: "Revenue", key: "revenue", type: "currency" },
        ],
        rows: [{ staff: "Priya", revenue: 3000 }],
        totals: { staff: "Total", revenue: 3000 },
      },
    ],
    filename: "test-full-featured",
  },
});

// ---- 4. Zero rows ----
cases.push({
  name: "zero rows",
  config: {
    title: "Empty Report",
    salon: SALON,
    columns: [
      { header: "Name", key: "name", type: "text" },
      { header: "Revenue", key: "revenue", type: "currency" },
    ],
    rows: [],
    totals: { name: "Total", revenue: 0 },
    filename: "test-zero-rows",
  },
});

// ---- 5. One config shaped like each real report page ----

// Revenue report (reports/revenue)
cases.push({
  name: "revenue report shape",
  config: {
    title: "Revenue Report — Daily Breakdown",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "Payment - CASH",
    generatedBy: "Owner",
    summary: [
      { label: "Gross Revenue", value: 50000, type: "currency" },
      { label: "GST Collected", value: 9000, type: "currency" },
      { label: "Discounts Given", value: 500, type: "currency" },
      { label: "Loyalty Discounts", value: 200, type: "currency" },
      { label: "Net Revenue", value: 49300, type: "currency" },
      { label: "Invoices", value: 42, type: "number" },
    ],
    columns: [
      { header: "Date", key: "date", type: "date" },
      { header: "Revenue", key: "revenue", type: "currency" },
      { header: "GST", key: "gst", type: "currency" },
      { header: "Discount", key: "discount", type: "currency" },
      { header: "Net", key: "net", type: "currency" },
      { header: "Invoices", key: "invoices", type: "number" },
    ],
    rows: [{ date: "2026-10-01", revenue: 1000, gst: 180, discount: 10, net: 990, invoices: 2 }],
    totals: { revenue: 1000, gst: 180, discount: 10, net: 990, invoices: 2 },
    filename: "test-revenue-shape",
  },
});

// Staff performance report (reports/staff) — 8 columns -> exercises landscape path
cases.push({
  name: "staff performance report shape",
  config: {
    title: "Staff Performance Report",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "None",
    generatedBy: "Owner",
    columns: [
      { header: "Staff", key: "name", type: "text" },
      { header: "Services Done", key: "servicesDone", type: "number" },
      { header: "Revenue", key: "revenue", type: "currency" },
      { header: "Invoices", key: "invoices", type: "number" },
      { header: "Avg Invoice", key: "avgInvoice", type: "currency" },
      { header: "Attendance %", key: "attendancePercent", type: "percent" },
      { header: "Present", key: "presentDays", type: "number" },
      { header: "Absent", key: "absentDays", type: "number" },
    ],
    rows: [
      {
        name: "Priya",
        servicesDone: 40,
        revenue: 20000,
        invoices: 18,
        avgInvoice: 1111.11,
        attendancePercent: 95,
        presentDays: 19,
        absentDays: 1,
      },
    ],
    filename: "test-staff-shape",
  },
});

// Customers report (reports/customers) — two tables via extraSections
cases.push({
  name: "customers report shape",
  config: {
    title: "Customer Analytics",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "None",
    generatedBy: "Owner",
    columns: [
      { header: "Rank", key: "rank", type: "number" },
      { header: "Customer", key: "name", type: "text" },
      { header: "Mobile", key: "mobile", type: "text" },
      { header: "Visits", key: "visits", type: "number" },
      { header: "Total Spent", key: "totalSpent", type: "currency" },
      { header: "Loyalty Tier", key: "tier", type: "text" },
      { header: "Last Visit", key: "lastVisit", type: "date" },
    ],
    rows: [{ rank: 1, name: "Anita", mobile: "9999999999", visits: 10, totalSpent: 15000, tier: "GOLD", lastVisit: "2026-10-10" }],
    extraSections: [
      {
        title: "New vs Returning",
        columns: [
          { header: "Month", key: "month", type: "text" },
          { header: "New Customers", key: "newCustomers", type: "number" },
          { header: "Returning", key: "returning", type: "number" },
          { header: "Total Visits", key: "totalVisits", type: "number" },
        ],
        rows: [{ month: "Oct 2026", newCustomers: 5, returning: 20, totalVisits: 30 }],
      },
    ],
    filename: "test-customers-shape",
  },
});

// Payroll report (reports/payroll) — extraSection with only text columns
cases.push({
  name: "payroll report shape",
  config: {
    title: "Payroll Reports",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "31/10/2026",
    filtersLabel: "None",
    generatedBy: "Owner",
    summary: [
      { label: "Gross", value: 100000, type: "currency" },
      { label: "Deductions", value: 5000, type: "currency" },
      { label: "Net", value: 95000, type: "currency" },
    ],
    columns: [
      { header: "Name", key: "staffName", type: "text" },
      { header: "Base", key: "baseSalary", type: "currency" },
      { header: "Commission", key: "commission", type: "currency" },
      { header: "Deduction", key: "deduction", type: "currency" },
      { header: "Net Pay", key: "netPay", type: "currency" },
    ],
    rows: [{ staffName: "Priya", baseSalary: 20000, commission: 2000, deduction: 500, netPay: 21500 }],
    extraSections: [
      {
        title: "Deduction Reasons",
        columns: [
          { header: "Name", key: "staffName", type: "text" },
          { header: "Reason", key: "reason", type: "text" },
        ],
        rows: [{ staffName: "Priya", reason: "Late arrival" }],
      },
    ],
    filename: "test-payroll-shape",
  },
});

// Profit & Loss (reports/profit-loss) — label/amount line-item rows, two extraSections
cases.push({
  name: "profit & loss report shape",
  config: {
    title: "Profit & Loss Statement",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "31/10/2026",
    generatedBy: "Owner",
    summary: [
      { label: "Total Revenue", value: 100000, type: "currency" },
      { label: "Gross Profit", value: 60000, type: "currency" },
      { label: "Total Expenses", value: 20000, type: "currency" },
      { label: "Net Profit", value: 40000, type: "currency" },
      { label: "Net Margin", value: 40, type: "percent" },
    ],
    columns: [
      { header: "Line Item", key: "label", type: "text" },
      { header: "Amount", key: "amount", type: "currency" },
    ],
    rows: [
      { label: "Service Revenue", amount: 80000 },
      { label: "Retail Product Revenue", amount: 20000 },
      { label: "Net Profit", amount: 40000 },
    ],
    extraSections: [
      {
        title: "Revenue Breakdown",
        columns: [
          { header: "Category", key: "category", type: "text" },
          { header: "Amount", key: "amount", type: "currency" },
        ],
        rows: [{ category: "Services", amount: 80000 }],
      },
      {
        title: "Expense Breakdown",
        columns: [
          { header: "Category", key: "category", type: "text" },
          { header: "Amount", key: "amount", type: "currency" },
        ],
        rows: [{ category: "Payroll", amount: 15000 }],
      },
    ],
    filename: "test-profit-loss-shape",
  },
});

// Inventory Summary (reports/inventory) — many extraSections, 6-column history table
cases.push({
  name: "inventory summary report shape",
  config: {
    title: "Inventory Summary",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    generatedBy: "Owner",
    summary: [
      { label: "Stock Value (Cost)", value: 50000, type: "currency" },
      { label: "Total Sold Value", value: 30000, type: "currency" },
      { label: "Total Products", value: 120, type: "number" },
      { label: "Total Stock Units", value: 4500, type: "number" },
    ],
    columns: [
      { header: "Product", key: "name", type: "text" },
      { header: "Units Sold", key: "unitsSold", type: "number" },
      { header: "Days Since Last Sale", key: "daysSinceLastSale", type: "number" },
    ],
    rows: [{ name: "Shampoo", unitsSold: 0, daysSinceLastSale: 30 }],
    extraSections: [
      {
        title: "Stock Movement History",
        columns: [
          { header: "Date", key: "date", type: "date" },
          { header: "Product", key: "productName", type: "text" },
          { header: "Type", key: "typeLabel", type: "text" },
          { header: "Quantity", key: "quantity", type: "number" },
          { header: "Reason / Notes", key: "reasonOrNotes", type: "text" },
          { header: "Entered By", key: "enteredBy", type: "text" },
        ],
        rows: [{ date: "05/10/2026", productName: "Shampoo", typeLabel: "Purchase", quantity: 10, reasonOrNotes: "-", enteredBy: "Admin" }],
      },
      {
        title: "Replenishment",
        columns: [
          { header: "Product", key: "productName", type: "text" },
          { header: "Current Stock", key: "currentStock", type: "number" },
          { header: "Reorder Level", key: "reorderLevel", type: "number" },
          { header: "Status", key: "statusLabel", type: "text" },
          { header: "Suggested Reorder Qty", key: "suggestedReorderQty", type: "number" },
        ],
        rows: [{ productName: "Shampoo", currentStock: 2, reorderLevel: 10, statusLabel: "Reorder now", suggestedReorderQty: 20 }],
      },
    ],
    filename: "test-inventory-summary-shape",
  },
});

// Usage report (reports/inventory/usage)
cases.push({
  name: "usage report shape",
  config: {
    title: "Usage Report",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "Product - Shampoo",
    generatedBy: "Owner",
    summary: [
      { label: "Total Entries", value: 5, type: "number" },
      { label: "Total Quantity", value: 50, type: "number" },
      { label: "Total Cost Value", value: 2500, type: "currency" },
      { label: "Products Used", value: 3, type: "number" },
    ],
    columns: [
      { header: "Period", key: "period", type: "text" },
      { header: "Product", key: "productName", type: "text" },
      { header: "Category", key: "category", type: "text" },
      { header: "Quantity", key: "quantity", type: "number" },
      { header: "Unit", key: "unit", type: "text" },
      { header: "Notes", key: "notes", type: "text" },
      { header: "Cost value", key: "costValue", type: "currency" },
      { header: "Entered by", key: "enteredBy", type: "text" },
    ],
    rows: [
      {
        period: "01 Oct - 07 Oct",
        productName: "Shampoo",
        category: "Hair Care",
        quantity: 5,
        unit: "ml",
        notes: "Used in colouring services",
        costValue: 250,
        enteredBy: "Admin",
      },
    ],
    extraSections: [
      {
        title: "Usage by product",
        columns: [
          { header: "Product", key: "productName", type: "text" },
          { header: "Total Quantity", key: "totalQuantity", type: "number" },
          { header: "Entries", key: "entries", type: "number" },
          { header: "Avg Per Week", key: "avgPerWeek", type: "number" },
          { header: "Current Stock", key: "currentStock", type: "number" },
          { header: "Reorder Level", key: "reorderLevel", type: "number" },
          { header: "Replenishment", key: "replenishment", type: "text" },
        ],
        rows: [
          { productName: "Shampoo", totalQuantity: 5, entries: 1, avgPerWeek: 1.25, currentStock: 20, reorderLevel: 10, replenishment: "OK" },
        ],
      },
    ],
    filename: "test-usage-shape",
  },
});

// Wastage report (reports/inventory/wastage)
cases.push({
  name: "wastage report shape",
  config: {
    title: "Wastage Report",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "Reason - Expired",
    generatedBy: "Owner",
    summary: [
      { label: "Total Entries", value: 3, type: "number" },
      { label: "Total Quantity", value: 12, type: "number" },
      { label: "Total Cost Value", value: 600, type: "currency" },
      { label: "Top Reason", value: "Expired", type: "text" },
    ],
    columns: [
      { header: "Date", key: "date", type: "date" },
      { header: "Product", key: "productName", type: "text" },
      { header: "Category", key: "category", type: "text" },
      { header: "Quantity", key: "quantity", type: "number" },
      { header: "Unit", key: "unit", type: "text" },
      { header: "Reason", key: "reason", type: "text" },
      { header: "Notes", key: "notes", type: "text" },
      { header: "Cost value", key: "costValue", type: "currency" },
      { header: "Entered by", key: "enteredBy", type: "text" },
    ],
    rows: [
      {
        date: "2026-10-05",
        productName: "Shampoo",
        category: "Hair Care",
        quantity: 2,
        unit: "ml",
        reason: "Expired",
        notes: "Past expiry",
        costValue: 100,
        enteredBy: "Admin",
      },
    ],
    filename: "test-wastage-shape",
  },
});

// Attendance reports (attendance/reports)
cases.push({
  name: "attendance report shape",
  config: {
    title: "Attendance Report",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "31/10/2026",
    filtersLabel: "Staff - Priya",
    generatedBy: "Owner",
    summary: [
      { label: "Present", value: 20, type: "number" },
      { label: "Absent", value: 2, type: "number" },
      { label: "Leave", value: 1, type: "number" },
      { label: "Week Off", value: 4, type: "number" },
    ],
    columns: [
      { header: "Staff", key: "staffName", type: "text" },
      { header: "Date", key: "date", type: "text" },
      { header: "Status", key: "status", type: "text" },
      { header: "Check In", key: "checkIn", type: "text" },
      { header: "Present", key: "presentCount", type: "number" },
      { header: "Absent", key: "absentCount", type: "number" },
      { header: "Leave", key: "leaveCount", type: "number" },
    ],
    rows: [{ staffName: "Priya", date: "01/10/2026", status: "Present", checkIn: "09:05", presentCount: 1, absentCount: 0, leaveCount: 0 }],
    filename: "test-attendance-shape",
  },
});

// Payroll history (payroll/history)
cases.push({
  name: "payroll history shape",
  config: {
    title: "Payroll History",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "31/10/2026",
    filtersLabel: "Staff - Priya, Year - 2026",
    generatedBy: "Owner",
    columns: [
      { header: "Staff", key: "staffName", type: "text" },
      { header: "Month", key: "month", type: "text" },
      { header: "Gross", key: "gross", type: "currency" },
      { header: "Deductions", key: "deductions", type: "currency" },
      { header: "Net", key: "net", type: "currency" },
    ],
    rows: [{ staffName: "Priya", month: "October 2026", gross: 25000, deductions: 1000, net: 24000 }],
    filename: "test-payroll-history-shape",
  },
});

// Low stock (inventory/low-stock)
cases.push({
  name: "low stock report shape",
  config: {
    title: "Low Stock Report",
    salon: SALON,
    asOnLabel: "14/10/2026",
    generatedBy: "Owner",
    columns: [
      { header: "Product", key: "name", type: "text" },
      { header: "Category", key: "category", type: "text" },
      { header: "Current Stock", key: "currentStock", type: "number" },
      { header: "Reorder Level", key: "reorderLevel", type: "number" },
      { header: "Status", key: "status", type: "text" },
    ],
    rows: [{ name: "Shampoo", category: "Hair Care", currentStock: 2, reorderLevel: 10, status: "Critical" }],
    filename: "test-low-stock-shape",
  },
});

// Billing invoices (billing/invoices)
cases.push({
  name: "billing invoices shape",
  config: {
    title: "Invoices",
    salon: SALON,
    fromDateLabel: "01/10/2026",
    toDateLabel: "14/10/2026",
    filtersLabel: "Payment - CASH",
    generatedBy: "Owner",
    columns: [
      { header: "Invoice #", key: "invoiceNumber", type: "text" },
      { header: "Date", key: "date", type: "date" },
      { header: "Customer", key: "customer", type: "text" },
      { header: "Total", key: "total", type: "currency" },
      { header: "Payment", key: "paymentMethod", type: "text" },
      { header: "Status", key: "status", type: "text" },
    ],
    rows: [{ invoiceNumber: "INV-1001", date: "2026-10-05", customer: "Anita", total: 1500, paymentMethod: "CASH", status: "PAID" }],
    totals: { total: 1500 },
    filename: "test-billing-invoices-shape",
  },
});

// Loyalty (loyalty)
cases.push({
  name: "loyalty report shape",
  config: {
    title: "Loyalty Members",
    salon: SALON,
    filtersLabel: "Search - anita",
    generatedBy: "Owner",
    columns: [
      { header: "Customer", key: "name", type: "text" },
      { header: "Mobile", key: "mobile", type: "text" },
      { header: "Tier", key: "tier", type: "text" },
      { header: "Points", key: "points", type: "number" },
    ],
    rows: [{ name: "Anita", mobile: "9999999999", tier: "GOLD", points: 1200 }],
    filename: "test-loyalty-shape",
  },
});

// Staff list (staff)
cases.push({
  name: "staff list shape",
  config: {
    title: "Staff Directory",
    salon: SALON,
    filtersLabel: "Status - ACTIVE",
    generatedBy: "Owner",
    columns: [
      { header: "Name", key: "name", type: "text" },
      { header: "Role", key: "role", type: "text" },
      { header: "Phone", key: "phone", type: "text" },
      { header: "Status", key: "status", type: "text" },
    ],
    rows: [{ name: "Priya", role: "Stylist", phone: "9876543210", status: "Active" }],
    filename: "test-staff-list-shape",
  },
});

// ---- No salon at all (optional config part absent) ----
cases.push({
  name: "config with no salon",
  config: {
    title: "No Salon Report",
    columns: [
      { header: "Name", key: "name", type: "text" },
      { header: "Amount", key: "amount", type: "currency" },
    ],
    rows: [{ name: "Row A", amount: 100 }],
    filename: "test-no-salon",
  } as ExportConfig,
});

async function checkWorkbookBuffer(testName: string, buffer: ExcelJS.Buffer, config: ExportConfig) {
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);

  const mainSheet = reloaded.worksheets[0];
  if (!mainSheet) {
    throw new Error(`[${testName}] reloaded workbook has no worksheets`);
  }

  const expectedHeaders = config.columns.map((column) => column.header);
  let headerRowFound = false;

  mainSheet.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1).map((value) => (value === null || value === undefined ? "" : String(value)));
    const matches = expectedHeaders.every((header, idx) => values[idx] === header);
    if (matches && expectedHeaders.length > 0) {
      headerRowFound = true;
    }
  });

  if (!headerRowFound) {
    throw new Error(`[${testName}] could not find a header row matching columns: ${expectedHeaders.join(", ")}`);
  }

  // Sanity: the sheet must have at least (data rows + 1 header row) rows written.
  const minExpectedRows = config.rows.length + 1;
  if (mainSheet.rowCount < minExpectedRows) {
    throw new Error(`[${testName}] expected at least ${minExpectedRows} rows, found ${mainSheet.rowCount}`);
  }
}

async function run() {
  let failures = 0;

  for (const testCase of cases) {
    try {
      const workbook = await buildExcelWorkbook(testCase.config);
      const buffer = await workbook.xlsx.writeBuffer();
      await checkWorkbookBuffer(testCase.name, buffer, testCase.config);
      console.log(`PASS  ${testCase.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL  ${testCase.name}`);
      console.error(error instanceof Error ? `       ${error.message}` : error);
    }
  }

  console.log(`\n${cases.length - failures}/${cases.length} export cases passed.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

run();
