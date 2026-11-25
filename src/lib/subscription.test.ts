/**
 * Unit tests for getDashboardBannerState in src/lib/subscription.ts.
 *
 * Run with: npm run test:trial (tsx --test src/lib/subscription.test.ts)
 *
 * Covers the dashboard notification-card decision for a free trial and a
 * paid plan at 14, 8, 7, 2, 1 and 0 days left, plus expired and no-end-date
 * cases, so the "7 days or fewer" boundary and the blue/red card mutual
 * exclusivity can never silently regress.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { getDashboardBannerState } from "./subscription";
import { addDaysToDateString, istWallTimeToInstant, todayISTDateString } from "./time";

function endDateDaysFromNow(days: number): Date {
  return istWallTimeToInstant(addDaysToDateString(todayISTDateString(), days));
}

const now = istWallTimeToInstant(todayISTDateString(), "12:00");

test("trial with 14 days left shows the blue 'trial' state", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(14), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial", daysLeft: 14 });
});

test("trial with 8 days left still shows 'trial' (boundary just above 7)", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(8), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial", daysLeft: 8 });
});

test("trial with 7 days left switches to the red 'trial_warning' state", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(7), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial_warning", daysLeft: 7 });
});

test("trial with 2 days left shows 'trial_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(2), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial_warning", daysLeft: 2 });
});

test("trial with 1 day left shows 'trial_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(1), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial_warning", daysLeft: 1 });
});

test("trial with 0 days left (ends today) shows 'trial_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(0), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "trial_warning", daysLeft: 0 });
});

test("trial that ended yesterday is 'expired'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: endDateDaysFromNow(-1), subscriptionEnd: null, isSubscribed: false, plan: "FREE_TRIAL" },
    now,
  );
  assert.deepEqual(result, { state: "expired" });
});

test("paid plan with 14 days left shows no card", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(14), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "none" });
});

test("paid plan with 8 days left still shows no card (boundary just above 7)", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(8), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "none" });
});

test("paid plan with 7 days left shows 'plan_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(7), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "plan_warning", daysLeft: 7 });
});

test("paid plan with 2 days left shows 'plan_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(2), isSubscribed: true, plan: "YEARLY" },
    now,
  );
  assert.deepEqual(result, { state: "plan_warning", daysLeft: 2 });
});

test("paid plan with 1 day left shows 'plan_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(1), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "plan_warning", daysLeft: 1 });
});

test("paid plan with 0 days left (ends today) shows 'plan_warning'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(0), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "plan_warning", daysLeft: 0 });
});

test("paid plan that ended yesterday is 'expired'", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: endDateDaysFromNow(-1), isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "expired" });
});

test("paid plan with no end date on file shows no card", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: null, isSubscribed: true, plan: "MONTHLY" },
    now,
  );
  assert.deepEqual(result, { state: "none" });
});

test("no trial end date and no subscription end date shows no card", () => {
  const result = getDashboardBannerState(
    { trialEndsAt: null, subscriptionEnd: null, isSubscribed: false, plan: "FREE" },
    now,
  );
  assert.deepEqual(result, { state: "none" });
});
