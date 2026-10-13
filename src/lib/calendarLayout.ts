/**
 * Pure layout helpers for the Day View calendar grid: turning the salon's
 * open/close hours into 30-minute row slots, and laying out same-column
 * blocks that overlap in time side by side instead of stacking them.
 */

/**
 * Row-height tuning for the compact Day View grid: the default height of a
 * 30-minute slot when the whole opening-to-closing range fits the viewport,
 * the floor it is never scaled below (so blocks stay tappable/readable),
 * and the ceiling it is never stretched beyond (so short business days don't
 * render with giant empty rows). 40px was chosen as the default because it's
 * the smallest height, at the 12px/11px compact type scale used here, where
 * a 30-minute block can still show its time range AND service name on two
 * lines without truncating both.
 */
export const DEFAULT_ROW_HEIGHT_PX = 40;
export const MIN_ROW_HEIGHT_PX = 28;
export const MAX_ROW_HEIGHT_PX = 44;

/** Kept for any lingering callers; equal to the default (unscaled) row height. */
export const ROW_HEIGHT_PX = DEFAULT_ROW_HEIGHT_PX;

export const SLOT_MINUTES = 30;

/** Fixed pixel widths used both for the CSS grid template and the staff-pager's scroll math. */
export const TIME_COLUMN_WIDTH_PX = 56;
export const STAFF_COLUMN_WIDTH_PX = 160;

/**
 * Scales the default row height down to fit `availableHeightPx` across
 * `slotCount` rows, never going below MIN or above MAX. Returns the default
 * when `availableHeightPx` is not known yet (e.g. before first measurement).
 */
export function computeRowHeightPx(availableHeightPx: number | null, slotCount: number): number {
  if (!availableHeightPx || slotCount <= 0) {
    return DEFAULT_ROW_HEIGHT_PX;
  }
  const ideal = availableHeightPx / slotCount;
  return Math.max(MIN_ROW_HEIGHT_PX, Math.min(MAX_ROW_HEIGHT_PX, ideal));
}

/** "HH:mm" -> minutes since 00:00. */
export function clockToMinutes(clock: string): number {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToClock(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60)
    .toString()
    .padStart(2, "0");
  const mm = (wrapped % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Builds the list of 30-minute row start times ("HH:mm") spanning
 * [open, close), extended to cover `extendToMinutes` if a block runs past
 * closing time, and/or `extendFromMinutes` if a (likely old/bad) line starts
 * before opening time, so every booked line is always visible somewhere on
 * the grid rather than being clipped off.
 */
export function buildGridSlots(
  open: string,
  close: string,
  extendToMinutes?: number,
  extendFromMinutes?: number,
): string[] {
  let openMin = clockToMinutes(open);
  let closeMin = clockToMinutes(close);

  if (extendFromMinutes !== undefined && extendFromMinutes < openMin) {
    openMin = Math.floor(extendFromMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  }

  if (extendToMinutes !== undefined && extendToMinutes > closeMin) {
    closeMin = Math.ceil((extendToMinutes - openMin) / SLOT_MINUTES) * SLOT_MINUTES + openMin;
  }

  const slots: string[] = [];
  for (let cursor = openMin; cursor < closeMin; cursor += SLOT_MINUTES) {
    slots.push(minutesToClock(cursor));
  }
  return slots;
}

export type LayoutInterval = {
  id: string;
  startMinutes: number;
  endMinutes: number;
};

export type LayoutResult = {
  id: string;
  lane: number;
  laneCount: number;
};

/**
 * Assigns each interval a lane (0-based column index) and the total lane
 * count of its overlap cluster, so overlapping blocks can be rendered side
 * by side (width = 100% / laneCount) instead of on top of one another.
 */
export function layoutOverlappingIntervals(intervals: LayoutInterval[]): Map<string, LayoutResult> {
  const sorted = [...intervals].sort((a, b) => a.startMinutes - b.startMinutes);
  const results = new Map<string, LayoutResult>();

  let clusterItems: Array<LayoutInterval & { lane: number }> = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (clusterItems.length === 0) {
      return;
    }
    const laneCount = Math.max(...clusterItems.map((item) => item.lane)) + 1;
    for (const item of clusterItems) {
      results.set(item.id, { id: item.id, lane: item.lane, laneCount });
    }
    clusterItems = [];
    clusterEnd = -Infinity;
  }

  for (const interval of sorted) {
    if (interval.startMinutes >= clusterEnd) {
      flushCluster();
    }

    // Lowest lane whose previous occupant in this cluster has already ended.
    const laneEnds: number[] = [];
    for (const item of clusterItems) {
      laneEnds[item.lane] = Math.max(laneEnds[item.lane] ?? -Infinity, item.endMinutes);
    }

    let lane = 0;
    while ((laneEnds[lane] ?? -Infinity) > interval.startMinutes) {
      lane += 1;
    }

    clusterItems.push({ ...interval, lane });
    clusterEnd = Math.max(clusterEnd, interval.endMinutes);
  }

  flushCluster();

  return results;
}
