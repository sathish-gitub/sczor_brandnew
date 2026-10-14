"use client";

export type FilterChip = {
  label: string;
  value: string;
  onClear?: () => void;
};

type FilterChipsProps = {
  chips: Array<FilterChip | null | undefined>;
};

/** Small chips showing the currently active report filters, placed above the table next to the download button. */
export function FilterChips({ chips }: FilterChipsProps) {
  const active = chips.filter((chip): chip is FilterChip => Boolean(chip && chip.value));

  if (active.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((chip, index) => (
        <span
          key={`${chip.label}-${index}`}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
        >
          {chip.label ? `${chip.label}: ${chip.value}` : chip.value}
          {chip.onClear ? (
            <button
              type="button"
              onClick={chip.onClear}
              aria-label={`Clear ${chip.label || chip.value}`}
              className="ml-0.5 text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
