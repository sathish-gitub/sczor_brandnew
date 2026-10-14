import type { SalonDetails } from "@/contexts/AccessContext";
import { formatISTDateDDMMYYYY, formatISTInstantTime12Hour } from "@/lib/time";

export type ExportColumnType = "text" | "number" | "currency" | "date" | "percent";
export type ExportColumnAlign = "left" | "center" | "right";

export type ExportColumn = {
  header: string;
  key: string;
  type?: ExportColumnType;
  /** Excel column width hint (characters); also used as a PDF column-width hint (converted to points) for dense tables where every column must fit on one page. */
  width?: number;
  /** Explicit text alignment override; otherwise inferred from `type`. */
  align?: ExportColumnAlign;
};

export type ExportSummaryItem = {
  label: string;
  value: string | number;
  type?: ExportColumnType;
};

export type ExportSalonDetails = {
  name: string;
  logo?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  gstNumber?: string | null;
};

export type ExportSection = {
  title: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
};

export type ExportConfig = {
  title: string;
  /** Optional: when absent, the salon block (name/address/contact/logo) is skipped entirely. */
  salon?: ExportSalonDetails;
  /** Date range label, e.g. "01/10/2026". Shown as "From Date: ..." */
  fromDateLabel?: string;
  /** Date range label, e.g. "14/10/2026". Shown as "To Date: ..." */
  toDateLabel?: string;
  /** For snapshot/point-in-time reports with no range. Shown as "As on: ..." */
  asOnLabel?: string;
  /** Human readable list of active filters, e.g. "Staff - Priya, Status - Paid". */
  filtersLabel?: string;
  /** Name of the signed-in user generating the export. */
  generatedBy?: string;
  summary?: ExportSummaryItem[];
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
  extraSections?: ExportSection[];
  filename: string;
};

/**
 * Shared colours, fonts and spacing used by both the PDF and Excel renderers so
 * every report looks consistent. Keep PDF values in `pt` (the jsPDF document unit)
 * and Excel values as ARGB hex (the exceljs colour format).
 */
export const EXPORT_STYLE = {
  pdf: {
    marginPt: mmToPt(14),
    logoHeightPt: mmToPt(12),
    logoGapPt: mmToPt(3),
    fontSizes: {
      salonName: 16,
      title: 13,
      body: 9,
      table: 8.5,
    },
    borderWidthPt: 0.5,
  },
  colors: {
    titleBandFillRgb: [253, 230, 138] as [number, number, number], // #FDE68A
    headerFillRgb: [229, 231, 235] as [number, number, number], // #E5E7EB
    totalsFillRgb: [229, 231, 235] as [number, number, number], // #E5E7EB
    zebraFillRgb: [249, 250, 251] as [number, number, number], // #F9FAFB
    blackRgb: [0, 0, 0] as [number, number, number],
    titleBandFillArgb: "FFFDE68A",
    headerFillArgb: "FFE5E7EB",
    totalsFillArgb: "FFE5E7EB",
    zebraFillArgb: "FFF9FAFB",
    borderArgb: "FF000000",
  },
};

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

export function formatPeriodLabel(startDate: string, endDate: string) {
  function toDisplay(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return `${toDisplay(startDate)} to ${toDisplay(endDate)}`;
}

/** Splits a "YYYY-MM-DD" date range into the "DD/MM/YYYY" from/to labels used by the export header. */
export function formatPeriodRange(startDate: string, endDate: string): { fromDateLabel: string; toDateLabel: string } {
  function toDisplay(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return { fromDateLabel: toDisplay(startDate), toDateLabel: toDisplay(endDate) };
}

/** Builds the "Filters: ..." label from a list of active filters, falling back to "None". */
export function formatFiltersLabel(filters: Array<{ label: string; value: string } | null | undefined>): string {
  const active = filters.filter((filter): filter is { label: string; value: string } => Boolean(filter && filter.value));

  if (active.length === 0) {
    return "None";
  }

  return active.map((filter) => `${filter.label} - ${filter.value}`).join(", ");
}

/** Converts the shared tenant/salon details from `AccessContext` into the export header shape. */
export function toExportSalonDetails(details: SalonDetails): ExportSalonDetails {
  return {
    name: details.tenantName,
    logo: details.tenantLogo,
    address: details.tenantAddress,
    city: details.tenantCity,
    state: details.tenantState,
    pincode: details.tenantPincode,
    phone: details.tenantPhone,
    email: details.tenantEmail,
    gstNumber: details.tenantGstNumber,
  };
}

const FONT_URL = "/fonts/NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";
const FONT_FILE = "NotoSans-Regular.ttf";

let fontBase64Promise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function loadRupeeFontBase64() {
  if (!fontBase64Promise) {
    fontBase64Promise = fetch(FONT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load the PDF font.");
        }
        return response.arrayBuffer();
      })
      .then((buffer) => arrayBufferToBase64(buffer));
  }

  return fontBase64Promise;
}

type LogoImage = { dataUrl: string; width: number; height: number; format: "PNG" | "JPEG" | "WEBP" | "GIF" };

/** Best-effort logo fetch for the PDF header; resolves to null (and never throws) if it can't be loaded. */
async function loadLogoImage(url: string): Promise<LogoImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const format: LogoImage["format"] = blob.type.includes("png")
      ? "PNG"
      : blob.type.includes("webp")
        ? "WEBP"
        : blob.type.includes("gif")
          ? "GIF"
          : "JPEG";

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read logo image."));
      reader.readAsDataURL(blob);
    });

    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      img.onerror = () => reject(new Error("Unable to read logo dimensions."));
      img.src = dataUrl;
    });

    if (!dimensions.width || !dimensions.height) {
      return null;
    }

    return { dataUrl, width: dimensions.width, height: dimensions.height, format };
  } catch (error) {
    console.error("Skipping logo in export; it could not be loaded.", error);
    return null;
  }
}

function formatGeneratedOn() {
  const now = new Date();
  return `${formatISTDateDDMMYYYY(now)} ${formatISTInstantTime12Hour(now)} (IST)`;
}

/** Address/contact/GST lines for the salon block, skipping any missing parts without leaving gaps. */
function buildSalonDetailLines(salon: ExportSalonDetails): string[] {
  const lines: string[] = [];

  const addressParts = [salon.address, salon.city, salon.state, salon.pincode].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (addressParts.length) {
    lines.push(addressParts.join(", "));
  }

  const contactParts: string[] = [];
  if (salon.phone) {
    contactParts.push(`Phone: ${salon.phone}`);
  }
  if (salon.email) {
    contactParts.push(`Email: ${salon.email}`);
  }
  if (contactParts.length) {
    lines.push(contactParts.join(" | "));
  }

  if (salon.gstNumber) {
    lines.push(`GSTIN: ${salon.gstNumber}`);
  }

  return lines;
}

/** The "From Date / To Date / As on / Filters / Generated on / Generated by" detail lines. */
function buildDetailLines(config: Pick<ExportConfig, "fromDateLabel" | "toDateLabel" | "asOnLabel" | "filtersLabel" | "generatedBy">): string[] {
  const lines: string[] = [];

  if (config.fromDateLabel) {
    lines.push(`From Date: ${config.fromDateLabel}`);
  }
  if (config.toDateLabel) {
    lines.push(`To Date: ${config.toDateLabel}`);
  }
  if (config.asOnLabel) {
    lines.push(`As on: ${config.asOnLabel}`);
  }
  lines.push(`Filters: ${config.filtersLabel && config.filtersLabel.trim() ? config.filtersLabel : "None"}`);
  lines.push(`Generated on: ${formatGeneratedOn()}`);
  if (config.generatedBy) {
    lines.push(`Generated by: ${config.generatedBy}`);
  }

  return lines;
}

/**
 * Alignment for each known column type; any column/type not present here (missing column,
 * missing `type`, or a typo'd type string) falls back to "left" via the default below.
 */
const ALIGN_BY_TYPE: Partial<Record<ExportColumnType, ExportColumnAlign>> = {
  number: "right",
  currency: "right",
  percent: "right",
  date: "center",
};

/** Safe alignment lookup: never throws, even if `column` itself is undefined or has no/unknown `type`. */
function resolveAlign(column: ExportColumn | undefined | null): ExportColumnAlign {
  if (!column) {
    return "left";
  }

  if (column.align) {
    return column.align;
  }

  return ALIGN_BY_TYPE[column.type as ExportColumnType] ?? "left";
}

function toDisplayValue(value: unknown, type: ExportColumnType = "text") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  switch (type) {
    case "currency": {
      const num = Number(value);
      return Number.isFinite(num)
        ? `\u20B9${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value);
    }
    case "percent": {
      const num = Number(value);
      return Number.isFinite(num) ? `${num.toFixed(2)}%` : String(value);
    }
    case "number": {
      const num = Number(value);
      return Number.isFinite(num) ? num.toLocaleString("en-IN") : String(value);
    }
    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    }
    default:
      return String(value);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

/* -------------------------------------------------------------------------- */
/* Excel                                                                      */
/* -------------------------------------------------------------------------- */

function sanitizeSheetName(title: string) {
  const cleaned = (title || "Report").replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || "Report").slice(0, 31);
}

function toCellValue(raw: unknown, type: ExportColumnType = "text") {
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }

  switch (type) {
    case "currency":
    case "number": {
      const num = Number(raw);
      return Number.isFinite(num) ? num : raw;
    }
    case "percent": {
      const num = Number(raw);
      return Number.isFinite(num) ? num / 100 : raw;
    }
    case "date": {
      const date = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(date.getTime()) ? String(raw) : date;
    }
    default:
      return String(raw);
  }
}

function excelAlign(align: ExportColumnAlign): "left" | "center" | "right" {
  return align;
}

function applyBlackBorder(cell: import("exceljs").Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: EXPORT_STYLE.colors.borderArgb } },
    left: { style: "thin", color: { argb: EXPORT_STYLE.colors.borderArgb } },
    bottom: { style: "thin", color: { argb: EXPORT_STYLE.colors.borderArgb } },
    right: { style: "thin", color: { argb: EXPORT_STYLE.colors.borderArgb } },
  };
}

function applyCellFormats(row: import("exceljs").Row, columns: ExportColumn[]) {
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    if (column.type === "currency") {
      cell.numFmt = "\u20B9#,##0.00";
    } else if (column.type === "percent") {
      cell.numFmt = "0.00%";
    } else if (column.type === "date") {
      cell.numFmt = "dd/mm/yyyy";
    } else if (column.type === "number") {
      cell.numFmt = "#,##0.##";
    }
    cell.alignment = { horizontal: excelAlign(resolveAlign(column)), wrapText: true, vertical: "middle" };
    applyBlackBorder(cell);
  });
}

function computeColumnWidth(column: ExportColumn, rows: Array<Record<string, unknown>>) {
  if (column.width) {
    return Math.min(45, Math.max(10, column.width));
  }

  let longest = column.header.length;
  for (const row of rows) {
    const display = toDisplayValue(row[column.key], column.type);
    longest = Math.max(longest, display.length);
  }

  return Math.min(45, Math.max(10, longest + 4));
}

type ExcelSheetConfig = {
  title: string;
  salon?: ExportSalonDetails;
  fromDateLabel?: string;
  toDateLabel?: string;
  asOnLabel?: string;
  filtersLabel?: string;
  generatedBy?: string;
  summary?: ExportSummaryItem[];
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
  landscape: boolean;
};

function buildExcelSheet(workbook: import("exceljs").Workbook, sheetTitle: string, config: ExcelSheetConfig) {
  const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetTitle));
  const columnCount = Math.max(config.columns.length, 1);

  function plainRow(text: string, options?: { bold?: boolean; size?: number }) {
    const row = worksheet.addRow([text]);
    row.font = { bold: options?.bold ?? false, size: options?.size ?? 10 };
    return row;
  }

  if (config.salon) {
    plainRow(config.salon.name, { bold: true, size: 16 });
    for (const line of buildSalonDetailLines(config.salon)) {
      plainRow(line, { size: 10 });
    }
    worksheet.addRow([]);
  }

  // Title band: bold black text, centred, soft yellow fill with a black border, merged across the table width.
  const titleRow = worksheet.addRow([config.title]);
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, columnCount);
  titleRow.height = 22;
  titleRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 13, color: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_STYLE.colors.titleBandFillArgb } };
    applyBlackBorder(cell);
  });

  if (config.salon) {
    for (const line of buildDetailLines(config)) {
      plainRow(line, { size: 10 });
    }
    worksheet.addRow([]);
  }

  if (config.summary?.length) {
    const summaryHeading = worksheet.addRow(["Summary"]);
    summaryHeading.font = { bold: true, size: 11 };
    for (const item of config.summary) {
      const row = worksheet.addRow([item.label, toCellValue(item.value, item.type)]);
      row.getCell(1).font = { bold: true };
      const numFmt =
        item.type === "currency" ? "\u20B9#,##0.00" : item.type === "percent" ? "0.00%" : item.type === "number" ? "#,##0.##" : null;
      if (numFmt) {
        row.getCell(2).numFmt = numFmt;
      }
      applyBlackBorder(row.getCell(1));
      applyBlackBorder(row.getCell(2));
    }
    worksheet.addRow([]);
  }

  const headerRowIndex = worksheet.rowCount + 1;
  const headerRow = worksheet.addRow(config.columns.map((column) => column.header));
  // ExcelJS Row.eachCell callbacks use a 1-based column number; config.columns is 0-based.
  headerRow.eachCell((cell, index) => {
    cell.font = { bold: true, color: { argb: "FF000000" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_STYLE.colors.headerFillArgb } };
    cell.alignment = { horizontal: excelAlign(resolveAlign(config.columns[index - 1])), vertical: "middle", wrapText: true };
    applyBlackBorder(cell);
  });

  config.columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = computeColumnWidth(column, config.rows);
  });

  config.rows.forEach((row, rowIndex) => {
    const values = config.columns.map((column) => toCellValue(row[column.key], column.type));
    const dataRow = worksheet.addRow(values);
    applyCellFormats(dataRow, config.columns);
    if (rowIndex % 2 === 1) {
      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_STYLE.colors.zebraFillArgb } };
      });
    }
  });

  if (config.totals) {
    const totalsValues = config.columns.map((column, index) => {
      if (index === 0 && !(column.key in config.totals!)) {
        return "Total";
      }
      return toCellValue(config.totals?.[column.key], column.type);
    });
    const totalsRow = worksheet.addRow(totalsValues);
    totalsRow.font = { bold: true };
    applyCellFormats(totalsRow, config.columns);
    totalsRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXPORT_STYLE.colors.totalsFillArgb } };
    });
  }

  worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columnCount },
  };

  worksheet.pageSetup = {
    orientation: config.landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.pageSetup.printTitlesRow = `${headerRowIndex}:${headerRowIndex}`;
  worksheet.headerFooter = { oddFooter: "&CPage &P of &N" };

  return worksheet;
}

/** Builds the full workbook (all sheets) for a report config without touching the DOM/download APIs — safe to call from Node (tests) or the browser. */
export async function buildExcelWorkbook(config: ExportConfig) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sczor";
  workbook.created = new Date();

  const landscape = config.columns.length > 6;

  buildExcelSheet(workbook, config.title || "Report", {
    title: config.title,
    salon: config.salon,
    fromDateLabel: config.fromDateLabel,
    toDateLabel: config.toDateLabel,
    asOnLabel: config.asOnLabel,
    filtersLabel: config.filtersLabel,
    generatedBy: config.generatedBy,
    summary: config.summary,
    columns: config.columns,
    rows: config.rows,
    totals: config.totals,
    landscape,
  });

  if (config.extraSections?.length) {
    for (const section of config.extraSections) {
      buildExcelSheet(workbook, section.title, {
        title: section.title,
        columns: section.columns,
        rows: section.rows,
        totals: section.totals,
        landscape: section.columns.length > 6,
      });
    }
  }

  return workbook;
}

export async function exportToExcel(config: ExportConfig) {
  const workbook = await buildExcelWorkbook(config);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${config.filename}.xlsx`);
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

export async function exportToPdf(config: ExportConfig) {
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const orientation = config.columns.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });

  let fontName = "helvetica";
  try {
    const base64 = await loadRupeeFontBase64();
    doc.addFileToVFS(FONT_FILE, base64);
    doc.addFont(FONT_FILE, FONT_NAME, "normal");
    doc.addFont(FONT_FILE, FONT_NAME, "bold");
    fontName = FONT_NAME;
  } catch (error) {
    console.error("Falling back to default PDF font; rupee symbol may not render.", error);
  }

  doc.setFont(fontName, "normal");

  const { marginPt, logoHeightPt, logoGapPt, fontSizes, borderWidthPt } = EXPORT_STYLE.pdf;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginPt * 2;

  const logo = config.salon?.logo ? await loadLogoImage(config.salon.logo) : null;

  let textX = marginPt;
  let cursorY = marginPt + 6;
  const headerTop = cursorY;

  if (logo) {
    const logoWidthPt = logoHeightPt * (logo.width / logo.height);
    try {
      doc.addImage(logo.dataUrl, logo.format, marginPt, headerTop - 4, logoWidthPt, logoHeightPt);
      textX = marginPt + logoWidthPt + logoGapPt;
    } catch (error) {
      console.error("Skipping logo in export; it could not be drawn.", error);
    }
  }

  if (config.salon) {
    doc.setFont(fontName, "bold");
    doc.setFontSize(fontSizes.salonName);
    doc.text(config.salon.name, textX, cursorY);
    cursorY += fontSizes.salonName + 4;

    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizes.body);
    for (const line of buildSalonDetailLines(config.salon)) {
      doc.text(line, textX, cursorY, { maxWidth: contentWidth - (textX - marginPt) });
      cursorY += fontSizes.body + 4;
    }
  }

  if (logo) {
    cursorY = Math.max(cursorY, headerTop + logoHeightPt + 6);
  }

  cursorY += 6;

  // Title band: centred bold black text on a soft yellow fill with a black border, full table width.
  const bandHeight = fontSizes.title + 14;
  doc.setFillColor(...EXPORT_STYLE.colors.titleBandFillRgb);
  doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
  doc.setLineWidth(borderWidthPt);
  doc.rect(marginPt, cursorY, contentWidth, bandHeight, "FD");
  doc.setFont(fontName, "bold");
  doc.setFontSize(fontSizes.title);
  doc.setTextColor(0, 0, 0);
  doc.text(config.title, marginPt + contentWidth / 2, cursorY + bandHeight / 2 + fontSizes.title / 3, { align: "center" });
  cursorY += bandHeight + 10;

  doc.setFont(fontName, "normal");
  doc.setFontSize(fontSizes.body);
  for (const line of buildDetailLines(config)) {
    doc.text(line, marginPt, cursorY);
    cursorY += fontSizes.body + 4;
  }

  cursorY += 6;

  function renderBorderedTable(
    startY: number,
    columns: ExportColumn[],
    rows: Array<Record<string, unknown>>,
    options: { totals?: Record<string, unknown>; headFillRgb?: [number, number, number] } = {},
  ) {
    const head = [columns.map((column) => column.header)];
    const body = rows.map((row) => columns.map((column) => toDisplayValue(row[column.key], column.type)));
    const foot = options.totals
      ? [
          columns.map((column, index) =>
            index === 0 && !(column.key in options.totals!) ? "Total" : toDisplayValue(options.totals![column.key], column.type),
          ),
        ]
      : undefined;

    autoTable(doc, {
      startY,
      head,
      body,
      foot,
      theme: "grid",
      styles: {
        font: fontName,
        fontSize: fontSizes.table,
        cellPadding: 5,
        lineColor: EXPORT_STYLE.colors.blackRgb,
        lineWidth: borderWidthPt,
        overflow: "linebreak",
        valign: "middle",
        textColor: EXPORT_STYLE.colors.blackRgb,
      },
      headStyles: {
        font: fontName,
        fontStyle: "bold",
        fillColor: options.headFillRgb ?? EXPORT_STYLE.colors.headerFillRgb,
        textColor: EXPORT_STYLE.colors.blackRgb,
        lineColor: EXPORT_STYLE.colors.blackRgb,
        lineWidth: borderWidthPt,
      },
      footStyles: {
        font: fontName,
        fontStyle: "bold",
        fillColor: EXPORT_STYLE.colors.totalsFillRgb,
        textColor: EXPORT_STYLE.colors.blackRgb,
        lineColor: EXPORT_STYLE.colors.blackRgb,
        lineWidth: borderWidthPt,
      },
      alternateRowStyles: { fillColor: EXPORT_STYLE.colors.zebraFillRgb },
      // `column.width` (an Excel character-width hint) doubles as a PDF column-width hint for
      // dense tables (e.g. a per-day attendance matrix) that need every column to fit on one
      // page; columns without an explicit width keep the previous auto-sized minimum.
      columnStyles: Object.fromEntries(
        columns.map((column, index) => [
          index,
          column.width
            ? { halign: resolveAlign(column), cellWidth: Math.max(14, column.width * 5) }
            : { halign: resolveAlign(column), minCellWidth: 34 },
        ]),
      ),
      margin: { left: marginPt, right: marginPt },
      showHead: "everyPage",
    });

    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  if (config.summary?.length) {
    const summaryRows = config.summary.map((item) => ({ label: item.label, value: toDisplayValue(item.value, item.type) }));
    cursorY = renderBorderedTable(
      cursorY,
      [
        { header: "Summary", key: "label", type: "text", align: "left" },
        { header: "", key: "value", type: "text", align: "right" },
      ],
      summaryRows,
    );
    cursorY += 10;
  }

  let nextY = renderBorderedTable(cursorY, config.columns, config.rows, { totals: config.totals });

  if (config.extraSections?.length) {
    for (const section of config.extraSections) {
      doc.addPage();
      doc.setFont(fontName, "bold");
      doc.setFontSize(fontSizes.title);
      doc.setFillColor(...EXPORT_STYLE.colors.titleBandFillRgb);
      doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
      doc.setLineWidth(borderWidthPt);
      const sectionBandHeight = fontSizes.title + 14;
      doc.rect(marginPt, marginPt, contentWidth, sectionBandHeight, "FD");
      doc.text(section.title, marginPt + contentWidth / 2, marginPt + sectionBandHeight / 2 + fontSizes.title / 3, { align: "center" });
      doc.setFont(fontName, "normal");
      nextY = renderBorderedTable(marginPt + sectionBandHeight + 14, section.columns, section.rows, { totals: section.totals });
    }
  }

  void nextY;

  // Footer + page numbers are added last so the true total page count is known.
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    const pageSize = doc.internal.pageSize;
    const footerY = pageSize.getHeight() - marginPt + 14;

    doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
    doc.setLineWidth(0.5);
    doc.line(marginPt, footerY - 12, pageSize.getWidth() - marginPt, footerY - 12);

    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("sczor", marginPt, footerY);
    doc.text(config.salon?.name ?? "", pageSize.getWidth() / 2, footerY, { align: "center" });
    doc.text(`Page ${i} of ${totalPages}`, pageSize.getWidth() - marginPt, footerY, { align: "right" });
  }

  doc.save(`${config.filename}.pdf`);
}

export type PurchaseOrderPdfSupplier = {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstNumber?: string | null;
};

export type PurchaseOrderPdfItem = {
  product: string;
  unitLabel: string;
  quantity: number;
  unitCost: number;
  amount: number;
};

export type PurchaseOrderPdfConfig = {
  salon?: ExportSalonDetails;
  poNumber: string;
  status: string;
  dateLabel: string;
  expectedDateLabel?: string | null;
  supplier: PurchaseOrderPdfSupplier;
  items: PurchaseOrderPdfItem[];
  subtotal: number;
  taxLabel?: string | null;
  taxAmount?: number | null;
  grandTotal: number;
  notes?: string | null;
  filename: string;
};

/**
 * A dedicated Purchase Order PDF (not a generic report export): salon block, title band,
 * PO metadata + supplier block, a bordered line-item table, a totals box, notes and a
 * signature line. Reuses the same shared style constants and font/logo loading as the
 * report exports so every PDF in the app looks consistent.
 */
export async function exportPurchaseOrderToPdf(config: PurchaseOrderPdfConfig) {
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  let fontName = "helvetica";
  try {
    const base64 = await loadRupeeFontBase64();
    doc.addFileToVFS(FONT_FILE, base64);
    doc.addFont(FONT_FILE, FONT_NAME, "normal");
    doc.addFont(FONT_FILE, FONT_NAME, "bold");
    fontName = FONT_NAME;
  } catch (error) {
    console.error("Falling back to default PDF font; rupee symbol may not render.", error);
  }

  doc.setFont(fontName, "normal");

  const { marginPt, logoHeightPt, logoGapPt, fontSizes, borderWidthPt } = EXPORT_STYLE.pdf;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginPt * 2;

  const logo = config.salon?.logo ? await loadLogoImage(config.salon.logo) : null;

  let textX = marginPt;
  let cursorY = marginPt + 6;
  const headerTop = cursorY;

  if (logo) {
    const logoWidthPt = logoHeightPt * (logo.width / logo.height);
    try {
      doc.addImage(logo.dataUrl, logo.format, marginPt, headerTop - 4, logoWidthPt, logoHeightPt);
      textX = marginPt + logoWidthPt + logoGapPt;
    } catch (error) {
      console.error("Skipping logo in export; it could not be drawn.", error);
    }
  }

  if (config.salon) {
    doc.setFont(fontName, "bold");
    doc.setFontSize(fontSizes.salonName);
    doc.text(config.salon.name, textX, cursorY);
    cursorY += fontSizes.salonName + 4;

    doc.setFont(fontName, "normal");
    doc.setFontSize(fontSizes.body);
    for (const line of buildSalonDetailLines(config.salon)) {
      doc.text(line, textX, cursorY, { maxWidth: contentWidth - (textX - marginPt) });
      cursorY += fontSizes.body + 4;
    }
  }

  if (logo) {
    cursorY = Math.max(cursorY, headerTop + logoHeightPt + 6);
  }

  cursorY += 6;

  // Title band: centred bold black text on a soft yellow fill with a black border, full table width.
  const bandHeight = fontSizes.title + 14;
  doc.setFillColor(...EXPORT_STYLE.colors.titleBandFillRgb);
  doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
  doc.setLineWidth(borderWidthPt);
  doc.rect(marginPt, cursorY, contentWidth, bandHeight, "FD");
  doc.setFont(fontName, "bold");
  doc.setFontSize(fontSizes.title);
  doc.setTextColor(0, 0, 0);
  doc.text("Purchase Order", marginPt + contentWidth / 2, cursorY + bandHeight / 2 + fontSizes.title / 3, { align: "center" });
  cursorY += bandHeight + 10;

  // PO metadata (left column) and supplier block (right column), side by side.
  doc.setFont(fontName, "normal");
  doc.setFontSize(fontSizes.body);

  const metaLines = [`PO Number: ${config.poNumber}`, `Date: ${config.dateLabel}`, `Status: ${config.status}`];
  if (config.expectedDateLabel) {
    metaLines.push(`Expected Date: ${config.expectedDateLabel}`);
  }

  const supplierLines = [`Supplier: ${config.supplier.name}`];
  if (config.supplier.contactPerson) {
    supplierLines.push(`Contact Person: ${config.supplier.contactPerson}`);
  }
  if (config.supplier.phone) {
    supplierLines.push(`Phone: ${config.supplier.phone}`);
  }
  if (config.supplier.email) {
    supplierLines.push(`Email: ${config.supplier.email}`);
  }
  if (config.supplier.address) {
    supplierLines.push(`Address: ${config.supplier.address}`);
  }
  if (config.supplier.gstNumber) {
    supplierLines.push(`GSTIN: ${config.supplier.gstNumber}`);
  }

  const columnWidth = contentWidth / 2 - 10;
  const metaStartY = cursorY;
  let metaY = metaStartY;
  for (const line of metaLines) {
    doc.text(line, marginPt, metaY, { maxWidth: columnWidth });
    metaY += fontSizes.body + 5;
  }

  let supplierY = metaStartY;
  for (const line of supplierLines) {
    doc.text(line, marginPt + columnWidth + 20, supplierY, { maxWidth: columnWidth });
    supplierY += fontSizes.body + 5;
  }

  cursorY = Math.max(metaY, supplierY) + 10;

  // Line-item table.
  const head = [["S.No", "Product", "Unit", "Quantity", "Unit Cost", "Line Total"]];
  const body = config.items.map((item, index) => [
    String(index + 1),
    item.product,
    item.unitLabel,
    toDisplayValue(item.quantity, "number"),
    toDisplayValue(item.unitCost, "currency"),
    toDisplayValue(item.amount, "currency"),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head,
    body,
    theme: "grid",
    styles: {
      font: fontName,
      fontSize: fontSizes.table,
      cellPadding: 5,
      lineColor: EXPORT_STYLE.colors.blackRgb,
      lineWidth: borderWidthPt,
      overflow: "linebreak",
      valign: "middle",
      textColor: EXPORT_STYLE.colors.blackRgb,
    },
    headStyles: {
      font: fontName,
      fontStyle: "bold",
      fillColor: EXPORT_STYLE.colors.headerFillRgb,
      textColor: EXPORT_STYLE.colors.blackRgb,
      lineColor: EXPORT_STYLE.colors.blackRgb,
      lineWidth: borderWidthPt,
    },
    alternateRowStyles: { fillColor: EXPORT_STYLE.colors.zebraFillRgb },
    columnStyles: {
      0: { halign: "center", cellWidth: 36 },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 70 },
      3: { halign: "right", cellWidth: 60 },
      4: { halign: "right", cellWidth: 70 },
      5: { halign: "right", cellWidth: 80 },
    },
    margin: { left: marginPt, right: marginPt },
    showHead: "everyPage",
  });

  let afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // Totals box, right-aligned under the table.
  const totalsRows: Array<[string, string]> = [["Subtotal", toDisplayValue(config.subtotal, "currency")]];
  if (config.taxLabel && config.taxAmount != null) {
    totalsRows.push([config.taxLabel, toDisplayValue(config.taxAmount, "currency")]);
  }
  totalsRows.push(["Grand Total", toDisplayValue(config.grandTotal, "currency")]);
  const lastTotalsRowIndex = totalsRows.length - 1;

  autoTable(doc, {
    startY: afterTableY,
    body: totalsRows,
    theme: "grid",
    tableWidth: 220,
    styles: {
      font: fontName,
      fontSize: fontSizes.table,
      cellPadding: 5,
      lineColor: EXPORT_STYLE.colors.blackRgb,
      lineWidth: borderWidthPt,
      textColor: EXPORT_STYLE.colors.blackRgb,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 120 },
      1: { halign: "right", cellWidth: 100 },
    },
    margin: { left: pageWidth - marginPt - 220, right: marginPt },
    didParseCell: (data) => {
      if (data.row.index === lastTotalsRowIndex) {
        data.cell.styles.fillColor = EXPORT_STYLE.colors.totalsFillRgb;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  if (config.notes) {
    doc.setFont(fontName, "bold");
    doc.setFontSize(fontSizes.body);
    doc.text("Notes:", marginPt, afterTableY);
    afterTableY += fontSizes.body + 4;
    doc.setFont(fontName, "normal");
    const noteLines = doc.splitTextToSize(config.notes, contentWidth);
    doc.text(noteLines, marginPt, afterTableY);
    afterTableY += noteLines.length * (fontSizes.body + 4) + 10;
  }

  // Signature line, placed after the content but never above the footer.
  const signatureY = Math.min(Math.max(afterTableY + 40, pageHeight - marginPt - 60), pageHeight - marginPt - 30);
  doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - marginPt - 160, signatureY, pageWidth - marginPt, signatureY);
  doc.setFont(fontName, "normal");
  doc.setFontSize(fontSizes.body);
  doc.text("Authorised signatory", pageWidth - marginPt - 160, signatureY + 14);

  // Footer + page numbers are added last so the true total page count is known.
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    const size = doc.internal.pageSize;
    const footerY = size.getHeight() - marginPt + 14;

    doc.setDrawColor(...EXPORT_STYLE.colors.blackRgb);
    doc.setLineWidth(0.5);
    doc.line(marginPt, footerY - 12, size.getWidth() - marginPt, footerY - 12);

    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("sczor", marginPt, footerY);
    doc.text(config.salon?.name ?? "", size.getWidth() / 2, footerY, { align: "center" });
    doc.text(`Page ${i} of ${totalPages}`, size.getWidth() - marginPt, footerY, { align: "right" });
  }

  doc.save(`${config.filename}.pdf`);
}
