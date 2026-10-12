export type ExportColumnType = "text" | "number" | "currency" | "date" | "percent";

export type ExportColumn = {
  header: string;
  key: string;
  type?: ExportColumnType;
  width?: number;
};

export type ExportSection = {
  title: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
};

export type ExportConfig = {
  title: string;
  salonName: string;
  periodLabel?: string;
  filtersLabel?: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
  extraSections?: ExportSection[];
  filename: string;
};

export function formatPeriodLabel(startDate: string, endDate: string) {
  function toDisplay(value: string) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return `${toDisplay(startDate)} to ${toDisplay(endDate)}`;
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

function formatGeneratedOn() {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  return `${datePart} ${timePart}`;
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

async function buildExcelSheet(workbook: import("exceljs").Workbook, sheetTitle: string, config: {
  title: string;
  salonName: string;
  periodLabel?: string;
  filtersLabel?: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
}) {
  const worksheet = workbook.addWorksheet(sheetTitle.slice(0, 31));
  const columnCount = config.columns.length;

  function mergedHeaderRow(text: string, bold = false, size = 11) {
    const row = worksheet.addRow([text]);
    worksheet.mergeCells(row.number, 1, row.number, Math.max(columnCount, 1));
    row.font = { bold, size };
    return row;
  }

  mergedHeaderRow(config.salonName, true, 14);
  mergedHeaderRow(config.title, true, 12);
  if (config.periodLabel) {
    mergedHeaderRow(`Period: ${config.periodLabel}`);
  }
  if (config.filtersLabel) {
    mergedHeaderRow(`Filters: ${config.filtersLabel}`);
  }
  mergedHeaderRow(`Generated on: ${formatGeneratedOn()} IST`);
  worksheet.addRow([]);

  const headerRowIndex = worksheet.rowCount + 1;
  const headerRow = worksheet.addRow(config.columns.map((column) => column.header));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  config.columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width ?? Math.max(14, column.header.length + 4);
  });

  config.rows.forEach((row) => {
    const values = config.columns.map((column) => {
      const raw = row[column.key];
      return toCellValue(raw, column.type);
    });
    const dataRow = worksheet.addRow(values);
    applyCellFormats(dataRow, config.columns);
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
  }

  worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: Math.max(columnCount, 1) },
  };

  return worksheet;
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
  });
}

export async function exportToExcel(config: ExportConfig) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sczor";
  workbook.created = new Date();

  await buildExcelSheet(workbook, config.title || "Report", config);

  if (config.extraSections?.length) {
    for (const section of config.extraSections) {
      await buildExcelSheet(workbook, section.title, {
        title: section.title,
        salonName: config.salonName,
        columns: section.columns,
        rows: section.rows,
        totals: section.totals,
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${config.filename}.xlsx`);
}

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

  const marginLeft = 36;
  let cursorY = 40;

  doc.setFontSize(14);
  doc.text(config.salonName, marginLeft, cursorY);
  cursorY += 18;

  doc.setFontSize(12);
  doc.text(config.title, marginLeft, cursorY);
  cursorY += 16;

  doc.setFontSize(9);
  if (config.periodLabel) {
    doc.text(`Period: ${config.periodLabel}`, marginLeft, cursorY);
    cursorY += 12;
  }
  if (config.filtersLabel) {
    doc.text(`Filters: ${config.filtersLabel}`, marginLeft, cursorY);
    cursorY += 12;
  }
  doc.text(`Generated on: ${formatGeneratedOn()} IST`, marginLeft, cursorY);
  cursorY += 10;

  function renderTable(startY: number, columns: ExportColumn[], rows: Array<Record<string, unknown>>, totals?: Record<string, unknown>) {
    const head = [columns.map((column) => column.header)];
    const body = rows.map((row) => columns.map((column) => toDisplayValue(row[column.key], column.type)));
    const foot = totals
      ? [columns.map((column, index) => (index === 0 && !(column.key in totals) ? "Total" : toDisplayValue(totals[column.key], column.type)))]
      : undefined;

    autoTable(doc, {
      startY,
      head,
      body,
      foot,
      styles: { font: fontName, fontSize: 8, cellPadding: 4 },
      headStyles: { font: fontName, fontStyle: "bold", fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      footStyles: { font: fontName, fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42] },
      margin: { left: marginLeft, right: marginLeft },
      showHead: "everyPage",
    });

    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  let nextY = renderTable(cursorY + 10, config.columns, config.rows, config.totals);

  if (config.extraSections?.length) {
    for (const section of config.extraSections) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont(fontName, "bold");
      doc.text(section.title, marginLeft, 40);
      doc.setFont(fontName, "normal");
      nextY = renderTable(56, section.columns, section.rows, section.totals);
    }
  }

  // Add page numbers after rendering so the true total page count is known.
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    const pageSize = doc.internal.pageSize;
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.text(`Page ${i} of ${totalPages}`, pageSize.getWidth() - marginLeft - 60, pageSize.getHeight() - 20);
  }

  void nextY;

  doc.save(`${config.filename}.pdf`);
}
