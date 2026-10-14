/**
 * Unit tests for src/lib/payrollProration.ts — the pure (no database access)
 * payroll proration formula. Run with:
 *   npx tsx --test src/lib/payrollProration.test.ts
 *
 * All test cases use salary 3000, October 2026 (31 days), period 1-13 Oct
 * unless noted, CALENDAR_DAYS method unless noted, per the task spec.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProratedPayroll, countAttendanceInPeriod, resolvePayrollPeriod, splitLeaveDays } from "./payrollProration";

const SALARY = 3000;
const TODAY = "2026-10-13"; // makes October 2026 the "current month", capping periodEnd at the 13th.

function octoberPeriod() {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 10,
    joiningDateStr: null,
    lastWorkingDateStr: null,
    todayDateStr: TODAY,
  });
  assert.ok(period, "October 2026 (as of 13 Oct) must have payable days");
  return period!;
}

test("resolvePayrollPeriod: current month is capped at today", () => {
  const period = octoberPeriod();
  assert.equal(period.periodStart, "2026-10-01");
  assert.equal(period.periodEnd, "2026-10-13");
});

test("resolvePayrollPeriod: future month has no payable days", () => {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 11,
    joiningDateStr: null,
    lastWorkingDateStr: null,
    todayDateStr: TODAY,
  });
  assert.equal(period, null);
});

test("resolvePayrollPeriod: joining after the month ended has no payable days", () => {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 9,
    joiningDateStr: "2026-10-05",
    lastWorkingDateStr: null,
    todayDateStr: TODAY,
  });
  assert.equal(period, null);
});

test("resolvePayrollPeriod: lastWorkingDate of 8 Oct ends the period at 8 Oct", () => {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 10,
    joiningDateStr: null,
    lastWorkingDateStr: "2026-10-08",
    todayDateStr: TODAY,
  });
  assert.ok(period);
  assert.equal(period!.periodStart, "2026-10-01");
  assert.equal(period!.periodEnd, "2026-10-08");
});

test("case 1: 1 absent day gives base 1258.06, deduction 96.77, net 1161.29", () => {
  const period = octoberPeriod();
  const counts = countAttendanceInPeriod(
    [{ status: "ABSENT", dateStr: "2026-10-05" }],
    period.periodStart,
    period.periodEnd,
  );
  const { paidLeaveDays, lopDays } = splitLeaveDays(counts.LEAVE, 1);
  assert.equal(paidLeaveDays, 0);
  assert.equal(lopDays, 0);

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 31,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    weekOffDaysInPeriod: 0,
    baseSalary: SALARY,
    absentDays: counts.ABSENT,
    lopDays,
    halfDays: counts.HALF_DAY,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.payableDays, 13);
  assert.equal(result.baseSalaryPaid, 1258.06);
  assert.equal(result.deduction, 96.77);
  assert.equal(result.netPay, 1161.29);
});

test("case 2: 1 half-day gives deduction 48.39 and net 1209.67", () => {
  const period = octoberPeriod();
  const counts = countAttendanceInPeriod(
    [{ status: "HALF_DAY", dateStr: "2026-10-05" }],
    period.periodStart,
    period.periodEnd,
  );

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 31,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    weekOffDaysInPeriod: 0,
    baseSalary: SALARY,
    absentDays: counts.ABSENT,
    lopDays: 0,
    halfDays: counts.HALF_DAY,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.baseSalaryPaid, 1258.06);
  assert.equal(result.deduction, 48.39);
  assert.equal(result.netPay, 1209.67);
});

test("case 3: 2 leave days with allowance 1 gives deduction 96.77", () => {
  const period = octoberPeriod();
  const counts = countAttendanceInPeriod(
    [
      { status: "LEAVE", dateStr: "2026-10-05" },
      { status: "LEAVE", dateStr: "2026-10-06" },
    ],
    period.periodStart,
    period.periodEnd,
  );
  const { paidLeaveDays, lopDays } = splitLeaveDays(counts.LEAVE, 1);
  assert.equal(paidLeaveDays, 1);
  assert.equal(lopDays, 1);

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 31,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    weekOffDaysInPeriod: 0,
    baseSalary: SALARY,
    absentDays: counts.ABSENT,
    lopDays,
    halfDays: counts.HALF_DAY,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.deduction, 96.77);
});

test("case 4: a stored Week Off day gives no deduction", () => {
  const period = octoberPeriod();
  const counts = countAttendanceInPeriod(
    [{ status: "WEEK_OFF", dateStr: "2026-10-05" }],
    period.periodStart,
    period.periodEnd,
  );

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 31,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    weekOffDaysInPeriod: 1,
    baseSalary: SALARY,
    absentDays: counts.ABSENT,
    lopDays: 0,
    halfDays: counts.HALF_DAY,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.deduction, 0);
  // Week Off is paid and does not reduce payableDays for CALENDAR_DAYS.
  assert.equal(result.payableDays, 13);
});

test("case 5: a full past month with all days present gives net 3000.00", () => {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 9,
    joiningDateStr: null,
    lastWorkingDateStr: null,
    todayDateStr: TODAY,
  });
  assert.ok(period);
  assert.equal(period!.periodStart, "2026-09-01");
  assert.equal(period!.periodEnd, "2026-09-30");

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 30,
    periodStart: period!.periodStart,
    periodEnd: period!.periodEnd,
    weekOffDaysInPeriod: 0,
    baseSalary: SALARY,
    absentDays: 0,
    lopDays: 0,
    halfDays: 0,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.payableDays, 30);
  assert.equal(result.baseSalaryPaid, 3000);
  assert.equal(result.netPay, 3000);
});

test("case 6: an attendance row dated 14 Oct (outside the period) is ignored", () => {
  const period = octoberPeriod();
  const counts = countAttendanceInPeriod(
    [{ status: "ABSENT", dateStr: "2026-10-14" }],
    period.periodStart,
    period.periodEnd,
  );

  assert.equal(counts.ABSENT, 0);
});

test("case 7: lastWorkingDate of 8 Oct ends the period at 8 Oct, base = 3000/31 x 8 = 774.19", () => {
  const period = resolvePayrollPeriod({
    year: 2026,
    month: 10,
    joiningDateStr: null,
    lastWorkingDateStr: "2026-10-08",
    todayDateStr: TODAY,
  });
  assert.ok(period);

  const result = computeProratedPayroll({
    dayMethod: "CALENDAR_DAYS",
    divisor: 31,
    periodStart: period!.periodStart,
    periodEnd: period!.periodEnd,
    weekOffDaysInPeriod: 0,
    baseSalary: SALARY,
    absentDays: 0,
    lopDays: 0,
    halfDays: 0,
    revenueInPeriod: 0,
    commissionRate: 0,
  });

  assert.equal(result.payableDays, 8);
  assert.equal(result.baseSalaryPaid, 774.19);
});
