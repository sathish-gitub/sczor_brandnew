const SIZED_UNITS = new Set(["ml", "g", "l", "kg"]);

export const UNIT_OPTIONS = [
  { value: "pcs", label: "PCS" },
  { value: "ml", label: "ML" },
  { value: "g", label: "G" },
  { value: "l", label: "L" },
  { value: "kg", label: "KG" },
];

/** Whether this unit requires a pack size (ML/G/L/KG, not PCS or legacy free-text units). */
export function isSizedUnit(unit: string) {
  return SIZED_UNITS.has(unit.trim().toLowerCase());
}

function trimTrailingZeros(value: number) {
  return Number(value.toFixed(2)).toString();
}

/** "500 ML", "1 L" — null when the unit isn't a sized unit or packSize is missing. */
export function formatPackSize(unit: string, packSize: number | null | undefined): string | null {
  if (!isSizedUnit(unit) || packSize === null || packSize === undefined) {
    return null;
  }

  return `${trimTrailingZeros(packSize)} ${unit.trim().toUpperCase()}`;
}

/** "10 × 500 ML" when pack size is known, otherwise falls back to the plain unit e.g. "10 pcs" / "10 ml". */
export function formatStock(currentStock: number, unit: string, packSize: number | null | undefined): string {
  const packLabel = formatPackSize(unit, packSize);

  if (packLabel) {
    return `${currentStock} × ${packLabel}`;
  }

  return `${currentStock} ${unit}`;
}
