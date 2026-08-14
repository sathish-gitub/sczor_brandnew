type RevenueChartDatum = {
  label: string;
  value: number;
};

type RevenueChartProps = {
  title: string;
  data: RevenueChartDatum[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueChart({ title, data }: RevenueChartProps) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>

      {data.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No chart data available.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {data.map((item) => {
            const width = Math.max(3, Math.round((item.value / max) * 100));

            return (
              <div key={item.label} className="group">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">{item.label}</span>
                  <span className="font-medium text-[var(--foreground)]">{formatCurrency(item.value)}</span>
                </div>
                <div className="relative h-7 rounded-lg bg-slate-100">
                  <div
                    className="absolute left-0 top-0 h-7 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
