type SummaryStripProps = {
  appointmentCount: number;
  lineCount: number;
  unassignedCount: number;
  freeSlotCount: number | null;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export function SummaryStrip({ appointmentCount, lineCount, unassignedCount, freeSlotCount }: SummaryStripProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Appointments" value={appointmentCount} />
      <Stat label="Service lines" value={lineCount} />
      <Stat label="Unassigned lines" value={unassignedCount} />
      <Stat label="Free slots" value={freeSlotCount ?? "—"} />
    </div>
  );
}
