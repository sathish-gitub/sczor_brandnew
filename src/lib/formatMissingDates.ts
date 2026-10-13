/**
 * Pure "YYYY-MM-DD" date-list formatting, with no server-only imports
 * (no Prisma), so it is safe to import from both API routes and client
 * components (e.g. the payroll page's missing-attendance popups/badges).
 */

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Groups ascending "YYYY-MM-DD" dates (all within the same payroll month)
 * into a short human label, e.g. ["2025-10-05","2025-10-06","2025-10-07"] ->
 * "5-7 Oct", or ["2025-10-05","2025-10-09"] -> "5 Oct, 9 Oct".
 */
export function formatMissingDatesSummary(dates: string[]): string {
  if (dates.length === 0) {
    return "";
  }

  const sorted = [...dates].sort();
  const groups: string[] = [];
  let rangeStartDay = Number(sorted[0].slice(8, 10));
  let rangeEndDay = rangeStartDay;
  const monthIndex = Number(sorted[0].slice(5, 7)) - 1;

  function pushGroup() {
    const monthName = MONTH_ABBREVIATIONS[monthIndex];
    groups.push(rangeStartDay === rangeEndDay ? `${rangeStartDay} ${monthName}` : `${rangeStartDay}-${rangeEndDay} ${monthName}`);
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const day = Number(sorted[i].slice(8, 10));

    if (day === rangeEndDay + 1) {
      rangeEndDay = day;
    } else {
      pushGroup();
      rangeStartDay = day;
      rangeEndDay = day;
    }
  }

  pushGroup();

  return groups.join(", ");
}
