/**
 * Unit tests for src/lib/time.ts IST helpers.
 *
 * These are intentionally host-timezone-independent: run with
 *   npx tsx --test src/lib/time.test.ts
 * under TZ=UTC, TZ=Asia/Kolkata, and TZ=America/New_York to confirm the
 * results never change (the whole point of going through Intl with an
 * explicit timeZone instead of bare Date methods).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addISTCalendarMonths,
  addISTCalendarYears,
  daysInMonthIST,
  endOfDayIST,
  endOfMonthIST,
  formatISTDateTime,
  formatISTDayMonth,
  getISTDayOfMonth,
  getISTMonth,
  getISTWeekday,
  getISTYear,
  istWallTimeToInstant,
  istYearBounds,
  startOfDayIST,
  startOfMonthIST,
  toISTDateString,
} from "./time";

test("23:30 IST stays on the same IST calendar day", () => {
  // 2024-03-15 23:30 IST = 2024-03-15 18:00 UTC
  const instant = istWallTimeToInstant("2024-03-15", "23:30");
  assert.equal(toISTDateString(instant), "2024-03-15");
  assert.equal(getISTDayOfMonth(instant), 15);
  assert.equal(instant.toISOString(), "2024-03-15T18:00:00.000Z");
});

test("00:30 IST stays on the correct IST calendar day (crosses UTC midnight backwards)", () => {
  // 2024-03-15 00:30 IST = 2024-03-14 19:00 UTC
  const instant = istWallTimeToInstant("2024-03-15", "00:30");
  assert.equal(toISTDateString(instant), "2024-03-15");
  assert.equal(instant.toISOString(), "2024-03-14T19:00:00.000Z");
  // A naive `new Date(instant).getDate()` on a UTC host would read 14, not 15.
  assert.equal(getISTDayOfMonth(instant), 15);
});

test("startOfDayIST / endOfDayIST bound exactly one IST calendar day", () => {
  const start = startOfDayIST("2024-03-15");
  const end = endOfDayIST("2024-03-15");
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(toISTDateString(start), "2024-03-15");
  assert.equal(toISTDateString(new Date(end.getTime() - 1)), "2024-03-15");
  assert.equal(toISTDateString(end), "2024-03-16");
});

test("month end: startOfMonthIST/endOfMonthIST bound February in a leap year", () => {
  assert.equal(daysInMonthIST(2024, 2), 29); // leap year
  assert.equal(daysInMonthIST(2023, 2), 28); // non-leap year
  const start = startOfMonthIST(2024, 2);
  const end = endOfMonthIST(2024, 2);
  assert.equal(toISTDateString(start), "2024-02-01");
  assert.equal(toISTDateString(new Date(end.getTime() - 1)), "2024-02-29");
  assert.equal(toISTDateString(end), "2024-03-01");
});

test("year end: 31 Dec 23:30 IST and 1 Jan 00:30 IST fall in the correct IST years", () => {
  const nye = istWallTimeToInstant("2023-12-31", "23:30");
  const nyd = istWallTimeToInstant("2024-01-01", "00:30");
  assert.equal(getISTYear(nye), 2023);
  assert.equal(getISTMonth(nye), 12);
  assert.equal(getISTYear(nyd), 2024);
  assert.equal(getISTMonth(nyd), 1);

  const bounds2023 = istYearBounds("2023-12-31");
  assert.equal(toISTDateString(bounds2023.start), "2023-01-01");
  assert.equal(toISTDateString(new Date(bounds2023.end.getTime() - 1)), "2023-12-31");
});

test("getISTWeekday matches Date.getDay() numbering (0=Sun..6=Sat)", () => {
  // 2024-03-15 is a Friday.
  const friday = istWallTimeToInstant("2024-03-15", "12:00");
  assert.equal(getISTWeekday(friday), 5);
  // 2024-03-17 is a Sunday.
  const sunday = istWallTimeToInstant("2024-03-17", "12:00");
  assert.equal(getISTWeekday(sunday), 0);
});

test("addISTCalendarMonths clamps day-of-month and preserves time-of-day", () => {
  // 31 Jan 10:15 IST + 1 month -> 29 Feb 2024 (leap year), same time-of-day.
  const jan31 = istWallTimeToInstant("2024-01-31", "10:15");
  const result = addISTCalendarMonths(jan31, 1);
  assert.equal(toISTDateString(result), "2024-02-29");

  // Crossing a year boundary: 15 Dec 2023 + 2 months -> 15 Feb 2024.
  const dec15 = istWallTimeToInstant("2023-12-15", "09:00");
  const plusTwo = addISTCalendarMonths(dec15, 2);
  assert.equal(toISTDateString(plusTwo), "2024-02-15");
});

test("addISTCalendarYears preserves month/day and clamps Feb 29 on non-leap years", () => {
  const leapDay = istWallTimeToInstant("2024-02-29", "08:00");
  const plusOneYear = addISTCalendarYears(leapDay, 1);
  assert.equal(toISTDateString(plusOneYear), "2025-02-28");
});

test("formatISTDateTime and formatISTDayMonth render fixed IST text regardless of host TZ", () => {
  const instant = istWallTimeToInstant("2024-09-15", "14:05");
  assert.equal(formatISTDayMonth(instant), "15 September");
  // Format should contain the IST date and a 2:05 PM time, not the UTC time.
  assert.match(formatISTDateTime(instant), /15\/09\/2024/);
  assert.match(formatISTDateTime(instant), /2:05\s?pm/i);
});
