"use client";

import { useState } from "react";
import { X } from "lucide-react";

type SpecializationChipsProps = {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  maxChips?: number;
  maxLength?: number;
};

const DEFAULT_MAX_CHIPS = 10;
const DEFAULT_MAX_LENGTH = 30;

export function SpecializationChips({
  value,
  onChange,
  suggestions = [],
  maxChips = DEFAULT_MAX_CHIPS,
  maxLength = DEFAULT_MAX_LENGTH,
}: SpecializationChipsProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addChip(raw: string) {
    const trimmed = raw.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed.length > maxLength) {
      setError(`Each specialization must be ${maxLength} characters or fewer.`);
      return;
    }

    if (value.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }

    if (value.length >= maxChips) {
      setError(`You can add up to ${maxChips} specializations.`);
      return;
    }

    setError(null);
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeChip(chip: string) {
    onChange(value.filter((item) => item !== chip));
  }

  const availableSuggestions = suggestions.filter(
    (item) => !value.some((chip) => chip.toLowerCase() === item.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[var(--primary)]"
          >
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              aria-label={`Remove ${chip}`}
              className="text-[var(--primary)] hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addChip(draft);
            } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
              removeChip(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? "Type and press Enter or comma to add" : ""}
          className="h-7 min-w-[140px] flex-1 border-none text-sm outline-none"
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {availableSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {availableSuggestions.slice(0, 12).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => addChip(item)}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-slate-600 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              + {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
