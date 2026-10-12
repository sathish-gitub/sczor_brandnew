"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import type { ExportConfig } from "@/lib/exportReport";

type ExportButtonsProps = {
  getConfig: () => ExportConfig | Promise<ExportConfig>;
  disabled?: boolean;
};

export function ExportButtons({ getConfig, disabled }: ExportButtonsProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleExport(format: "excel" | "pdf") {
    setOpen(false);
    setBusy(format);

    try {
      const config = await getConfig();

      if (format === "excel") {
        const { exportToExcel } = await import("@/lib/exportReport");
        await exportToExcel(config);
      } else {
        const { exportToPdf } = await import("@/lib/exportReport");
        await exportToPdf(config);
      }
    } catch (error) {
      console.error("Export failed", error);
      showToast({
        title: "Export failed",
        message: error instanceof Error ? error.message : "Unable to generate the file. Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || busy !== null}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {busy ? "Preparing…" : "Download"}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5 text-red-600" />
            PDF
          </button>
        </div>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label="Close export menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
        />
      ) : null}
    </div>
  );
}
