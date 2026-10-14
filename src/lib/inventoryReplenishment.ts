/** Shared reorder/replenishment math used by the Inventory Summary, Usage and Wastage reports. */

export type ReplenishmentStatus = "REORDER_NOW" | "LOW" | "OK";

export const REPLENISHMENT_STATUS_LABELS: Record<ReplenishmentStatus, string> = {
  REORDER_NOW: "Reorder now",
  LOW: "Low",
  OK: "OK",
};

export type ReplenishmentInfo = {
  status: ReplenishmentStatus;
  statusLabel: string;
  /** Suggested quantity to reorder, rounded up to a whole pack when the product has a pack size. */
  suggestedReorderQty: number;
};

/**
 * `status`: "Reorder now" at or below the reorder level, "Low" within 120% of it, otherwise "OK".
 * `suggestedReorderQty`: max(0, reorderLevel * 2 - currentStock), rounded up to a whole pack.
 */
export function computeReplenishment(
  currentStock: number,
  reorderLevel: number,
  packSize: number | null | undefined,
): ReplenishmentInfo {
  let status: ReplenishmentStatus;

  if (currentStock <= reorderLevel) {
    status = "REORDER_NOW";
  } else if (currentStock <= reorderLevel * 1.2) {
    status = "LOW";
  } else {
    status = "OK";
  }

  const rawSuggested = Math.max(0, reorderLevel * 2 - currentStock);
  const suggestedReorderQty =
    packSize && packSize > 0 ? Math.ceil(rawSuggested / packSize) * packSize : Math.ceil(rawSuggested);

  return { status, statusLabel: REPLENISHMENT_STATUS_LABELS[status], suggestedReorderQty };
}
