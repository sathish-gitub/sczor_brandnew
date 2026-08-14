"use client";

import { useMemo, useState } from "react";

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
  csvFileName?: string;
};

export function DataTable<T>({ columns, rows, pageSize = 10, emptyText = "No data", csvFileName = "table.csv" }: DataTableProps<T>) {
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

  function exportCsv() {
    const header = columns.map((column) => column.label);
    const content = sortedRows.map((row) =>
      columns.map((column) => {
        const value = column.render(row);
        return typeof value === "string" || typeof value === "number" ? String(value) : "";
      }),
    );

    const csvText = [header, ...content]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = csvFileName;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center text-sm text-[var(--muted)]">{emptyText}</div>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex justify-end">
        <button type="button" onClick={exportCsv} className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700">Export CSV</button>
      </div>

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
