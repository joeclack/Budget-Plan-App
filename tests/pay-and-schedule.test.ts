import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateBudget,
  paymentDate,
  scheduledPayments,
  upcomingPayments,
} from "../src/domain/budget";
import { calculatePay, validatePayProfile } from "../src/domain/pay";
import type { PayProfile, PensionMethod } from "../src/domain/pay";
import { createBudgetFixture } from "./budget-fixture";

function profile(
  method: PensionMethod,
  salary = 4_800_000,
  rate = 500,
): PayProfile {
  return {
    id: "primary",
    annualSalaryMinor: salary,
    pensionRateBps: rate,
    pensionMethod: method,
    pensionBasis: "whole_salary",
    country: "england",
    taxYear: "2026/27",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

test("whole-salary pension methods keep their tax, NI and cash bases separate", () => {
  assert.deepEqual(
    calculatePay(profile("net_pay"), "2026-09-21T00:00:00.000Z"),
    {
      annualSalaryMinor: 4800000,
      monthlyGrossMinor: 400000,
      monthlyTaxMinor: 55050,
      monthlyNationalInsuranceMinor: 23616,
      monthlyPensionDeductionMinor: 20000,
      monthlyPensionGrossMinor: 20000,
      monthlyTakeHomeMinor: 301334,
      annualTaxablePayMinor: 4560000,
      personalAllowanceMinor: 1257000,
      rulesetVersion: "uk-rUK-2026-27-v1",
      calculatedAt: "2026-09-21T00:00:00.000Z",
    },
  );
  const relief = calculatePay(profile("relief_at_source"));
  assert.equal(relief.monthlyTaxMinor, 59050);
  assert.equal(relief.monthlyNationalInsuranceMinor, 23616);
  assert.equal(relief.monthlyPensionDeductionMinor, 16000);
  assert.equal(relief.monthlyPensionGrossMinor, 20000);
  assert.equal(relief.monthlyTakeHomeMinor, 301334);
  const sacrifice = calculatePay(profile("salary_sacrifice"));
  assert.equal(sacrifice.monthlyTaxMinor, 55050);
  assert.equal(sacrifice.monthlyNationalInsuranceMinor, 22016);
  assert.equal(sacrifice.monthlyTakeHomeMinor, 302934);
});

test("allowance taper, higher tax and monthly NI thresholds reconcile at representative salaries", () => {
  const result = calculatePay(profile("net_pay", 12_000_000, 0));
  assert.equal(result.personalAllowanceMinor, 257000);
  assert.equal(result.monthlyTaxMinor, 328600);
  assert.equal(result.monthlyNationalInsuranceMinor, 36750);
  assert.equal(result.monthlyTakeHomeMinor, 634650);
  const threshold = calculatePay(profile("net_pay", 1_258_320, 0));
  assert.equal(threshold.monthlyNationalInsuranceMinor, 5);
});

test("unsupported or out-of-range pay inputs fail explicitly", () => {
  assert.throws(
    () =>
      validatePayProfile({
        ...profile("net_pay"),
        annualSalaryMinor: 1_000_000_001,
      }),
    /10,000,000/,
  );
  assert.throws(
    () => validatePayProfile({ ...profile("net_pay"), pensionRateBps: 10001 }),
    /100%/,
  );
  assert.throws(
    () =>
      validatePayProfile({
        ...profile("net_pay"),
        country: "scotland" as never,
      }),
    /supports/,
  );
  assert.throws(
    () => calculatePay(profile("net_pay"), "not-a-date"),
    /Calculation time/,
  );
});

test("scheduled payments sort by effective date and clamp short months", () => {
  const document = createBudgetFixture(2027, 2);
  const rent = document.rows.find((row) => row.label === "Rent")!;
  const car = document.rows.find((row) => row.label === "Car finance")!;
  const subtotal = document.rows.find(
    (row) => row.allocationRole === "informational",
  )!;
  rent.dueDay = 31;
  car.dueDay = 3;
  subtotal.dueDay = 1;
  const payments = scheduledPayments(
    document,
    evaluateBudget(document).rows,
    new Date(2027, 1, 3),
  );
  assert.deepEqual(
    payments.map((item) => [item.row.label, item.date.getDate(), item.status]),
    [
      ["Car finance", 3, "today"],
      ["Rent", 28, "upcoming"],
    ],
  );
  assert.equal(paymentDate(2028, 2, 31).getDate(), 29);
});

test("the upcoming list contains only the next three non-past payments", () => {
  const document = createBudgetFixture(2026, 9);
  const rows = new Map(document.rows.map((row) => [row.label, row]));
  rows.get("Salary")!.dueDay = 2;
  rows.get("Car finance")!.dueDay = 3;
  rows.get("Broadband")!.dueDay = 4;
  rows.get("Mobile")!.dueDay = 5;
  rows.get("Memberships")!.dueDay = 6;
  rows.get("Rent")!.dueDay = 30;
  const payments = upcomingPayments(
    document,
    evaluateBudget(document).rows,
    new Date(2026, 8, 3),
  );
  assert.deepEqual(
    payments.map((payment) => payment.row.label),
    ["Car finance", "Broadband", "Mobile"],
  );
  assert.deepEqual(
    payments.map((payment) => payment.status),
    ["today", "upcoming", "upcoming"],
  );
});
