/**
 * Fixed, accessible palette used by the Day View calendar's "Colour by:
 * Staff" and "Colour by: Service category" modes. Each entry pairs a pale
 * Tailwind background with dark text (WCAG AA, ~8:1+ contrast at these
 * shade pairings) and a saturated swatch used for the 3px left border and
 * the legend dot. Colours are assigned stably by hashing the staff/category
 * id so the same staff member or category always gets the same colour
 * across reloads, independent of sort order.
 */

export type PaletteEntry = {
  key: string;
  /** Pale background + dark text, used on calendar blocks. */
  blockClassName: string;
  /** Swatch hex, used for the legend dot. */
  swatchHex: string;
};

const PALETTE: PaletteEntry[] = [
  { key: "blue", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#3B82F6] bg-[#EFF6FF] text-[#1E3A8A]", swatchHex: "#3B82F6" },
  { key: "teal", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#06B6D4] bg-[#ECFEFF] text-[#164E63]", swatchHex: "#06B6D4" },
  { key: "green", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#10B981] bg-[#ECFDF5] text-[#065F46]", swatchHex: "#10B981" },
  { key: "lime", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#84CC16] bg-[#F7FEE7] text-[#3F6212]", swatchHex: "#84CC16" },
  { key: "amber", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#F59E0B] bg-[#FFFBEB] text-[#78350F]", swatchHex: "#F59E0B" },
  { key: "orange", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#F97316] bg-[#FFF7ED] text-[#7C2D12]", swatchHex: "#F97316" },
  { key: "rose", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#F43F5E] bg-[#FFF1F2] text-[#881337]", swatchHex: "#F43F5E" },
  { key: "pink", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#EC4899] bg-[#FDF2F8] text-[#831843]", swatchHex: "#EC4899" },
  { key: "purple", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#A855F7] bg-[#FAF5FF] text-[#581C87]", swatchHex: "#A855F7" },
  { key: "indigo", blockClassName: "border border-slate-200 border-l-[3px] border-l-[#6366F1] bg-[#EEF2FF] text-[#312E81]", swatchHex: "#6366F1" },
];

/** Stable string hash (FNV-1a-ish) so the same id always maps to the same palette slot. */
function hashStringToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

export function getPaletteEntryForKey(key: string): PaletteEntry {
  return PALETTE[hashStringToIndex(key, PALETTE.length)];
}
