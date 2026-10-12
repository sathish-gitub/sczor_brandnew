"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown to the right of the label, e.g. price/duration or designation. */
  description?: string;
  /** Optional group heading, e.g. a service category. */
  group?: string;
  disabled?: boolean;
  /** Shown next to the option when disabled, e.g. "Already added" or "Busy 11:00 AM to 11:45 AM". */
  disabledReason?: string;
};

type SearchableComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableComboboxOption[];
  placeholder: string;
  /** Label for the always-selectable "clear" option, e.g. "Unassigned". Omit to require a selection. */
  clearLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  hasError?: boolean;
};

/**
 * A type-to-search single-select dropdown. Built in-repo because no existing
 * searchable select component exists; the plain `<select>`s used elsewhere
 * can't show disabled options with a reason or group by category.
 */
export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder,
  clearLabel,
  searchPlaceholder = "Type to search...",
  disabled = false,
  hasError = false,
  ...rest
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  function closeDropdown() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.description?.toLowerCase().includes(normalizedQuery) ||
        option.group?.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, SearchableComboboxOption[]>();

    for (const option of filteredOptions) {
      const key = option.group ?? "";
      const list = groups.get(key);
      if (list) {
        list.push(option);
      } else {
        groups.set(key, [option]);
      }
    }

    return [...groups.entries()];
  }, [filteredOptions]);

  function selectOption(option: SearchableComboboxOption) {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label={rest["aria-label"]}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
          hasError ? "border-red-300" : "border-[var(--border)] focus:border-[var(--accent)]"
        }`}
      >
        <span className={selected ? "truncate text-[var(--foreground)]" : "truncate text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 w-full text-sm outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            ) : null}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {clearLabel ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  value === "" ? "bg-slate-50 font-semibold text-[var(--accent)]" : "text-[var(--foreground)]"
                }`}
              >
                {clearLabel}
              </button>
            ) : null}

            {groupedOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">No matches found.</p>
            ) : (
              groupedOptions.map(([group, groupOptions]) => (
                <div key={group || "__ungrouped"}>
                  {group ? (
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {group}
                    </p>
                  ) : null}
                  {groupOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => selectOption(option)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        option.disabled
                          ? "cursor-not-allowed text-slate-300"
                          : option.value === value
                            ? "bg-slate-50 font-semibold text-[var(--accent)]"
                            : "text-[var(--foreground)] hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
                      <span className={`shrink-0 text-xs ${option.disabled ? "text-slate-300" : "text-slate-400"}`}>
                        {option.disabled ? option.disabledReason : option.description}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
