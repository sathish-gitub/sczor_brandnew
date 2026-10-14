"use client";

import { useMemo, useState } from "react";

import { ExportButtons } from "@/components/reports/ExportButtons";
import type { ExportConfig } from "@/lib/exportReport";

type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render: (row: T) => string | number | React.ReactNode;
  sortValue?: (row: T) => string | number;
};

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  pageSize?: number;
  emptyText?: string;
  exportConfig?: Omit<ExportConfig, "rows">;
  filterChips?: React.ReactNode;
};

export function DataTable<T>({ columns, rows, pageSize = 10, emptyText = "No data", exportConfig, filterChips }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return rows;
    }

    const column = columns.find((item) => item.key === sortKey);
    if (!column || !column.sortable || !column.sortValue) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);

      if (left < right) {
        return sortOrder === "asc" ? -1 : 1;
      }

      if (left > right) {
        return sortOrder === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [rows, columns, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable) {
      return;
    }

    if (sortKey === column.key) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(column.key);
    setSortOrder("asc");
  }

  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center text-sm text-[var(--muted)]">{emptyText}</div>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
      {exportConfig || filterChips ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{filterChips}</div>
          {exportConfig ? (
            <ExportButtons getConfig={() => ({ ...exportConfig, rows: sortedRows as unknown as Array<Record<string, unknown>> })} />
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className={column.sortable ? "inline-flex items-center gap-1 hover:text-[var(--foreground)]" : "inline-flex"}
                  >
                    {column.label}
                    {sortKey === column.key ? <span>{sortOrder === "asc" ? "▲" : "▼"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, index) => (
              <tr key={index} className="border-t border-[var(--border)]">
                {columns.map((column) => (
                  <td key={column.key} className="py-2">{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs disabled:opacity-50">Prev</button>
        <p className="text-xs text-[var(--muted)]">{page}/{totalPages}</p>
        <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
