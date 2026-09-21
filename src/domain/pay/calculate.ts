import { PAY_RULES } from "./rules";
import type { PayEstimate, PayProfile } from "./types";

const MAX_SALARY_MINOR = 1_000_000_000; // £10,000,000, shown in the UI.
function roundDivide(value: bigint, divisor: bigint) {
  const sign = value < 0n ? -1n : 1n;
  const magnitude = value < 0n ? -value : value;
  return Number(sign * ((magnitude + divisor / 2n) / divisor));
}
const percent = (value: number, basisPoints: number) =>
  roundDivide(BigInt(value) * BigInt(basisPoints), 10_000n);
const monthly = (annual: number) => roundDivide(BigInt(annual), 12n);

export function validatePayProfile(profile: PayProfile) {
  if (profile.id !== "primary") throw new Error("Invalid pay profile.");
  if (
    typeof profile.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(profile.updatedAt))
  )
    throw new Error("Pay profile update time is invalid.");
  if (
    !Number.isSafeInteger(profile.annualSalaryMinor) ||
    profile.annualSalaryMinor < 0 ||
    profile.annualSalaryMinor > MAX_SALARY_MINOR
  )
    throw new Error("Annual salary must be between £0 and £10,000,000.");
  if (
    !Number.isInteger(profile.pensionRateBps) ||
    profile.pensionRateBps < 0 ||
    profile.pensionRateBps > 10_000
  )
    throw new Error("Pension contribution must be between 0% and 100%.");
  if (!(profile.taxYear in PAY_RULES)) throw new Error("Unsupported tax year.");
  if (!["england", "wales", "northern_ireland"].includes(profile.country))
    throw new Error(
      "This calculator supports England, Wales and Northern Ireland.",
    );
  if (
    !["net_pay", "relief_at_source", "salary_sacrifice"].includes(
      profile.pensionMethod,
    )
  )
    throw new Error("Unsupported pension method.");
  if (profile.pensionBasis !== "whole_salary")
    throw new Error("Pension basis must be whole salary.");
}

export function calculatePay(
  profile: PayProfile,
  calculatedAt = new Date().toISOString(),
): PayEstimate {
  validatePayProfile(profile);
  if (
    typeof calculatedAt !== "string" ||
    !Number.isFinite(Date.parse(calculatedAt))
  )
    throw new Error("Calculation time is invalid.");
  const rules = PAY_RULES[profile.taxYear];
  const pensionGrossAnnual = percent(
    profile.annualSalaryMinor,
    profile.pensionRateBps,
  );
  const taxableAnnual =
    profile.pensionMethod === "relief_at_source"
      ? profile.annualSalaryMinor
      : profile.annualSalaryMinor - pensionGrossAnnual;
  const niAnnual =
    profile.pensionMethod === "salary_sacrifice"
      ? profile.annualSalaryMinor - pensionGrossAnnual
      : profile.annualSalaryMinor;
  const taper = Math.max(
    0,
    Math.floor((taxableAnnual - rules.allowanceTaperStartsMinor) / 2),
  );
  const allowance = Math.max(0, rules.personalAllowanceMinor - taper);
  const taxableAfterAllowance = Math.max(0, taxableAnnual - allowance);
  const basic = Math.min(taxableAfterAllowance, rules.basicBandMinor);
  const higher = Math.max(
    0,
    Math.min(taxableAfterAllowance, rules.additionalThresholdMinor) -
      rules.basicBandMinor,
  );
  const additional = Math.max(
    0,
    taxableAfterAllowance - rules.additionalThresholdMinor,
  );
  const annualTax =
    percent(basic, 2_000) + percent(higher, 4_000) + percent(additional, 4_500);
  const niMonthlyEarnings = monthly(niAnnual);
  const mainNi = Math.max(
    0,
    Math.min(niMonthlyEarnings, rules.niUpperMonthlyMinor) -
      rules.niPrimaryMonthlyMinor,
  );
  const upperNi = Math.max(0, niMonthlyEarnings - rules.niUpperMonthlyMinor);
  const monthlyNi = percent(mainNi, 800) + percent(upperNi, 200);
  const pensionGrossMonthly = monthly(pensionGrossAnnual);
  const pensionDeductionMonthly =
    profile.pensionMethod === "relief_at_source"
      ? percent(pensionGrossMonthly, 8_000)
      : pensionGrossMonthly;
  return {
    annualSalaryMinor: profile.annualSalaryMinor,
    monthlyGrossMinor: monthly(profile.annualSalaryMinor),
    monthlyTaxMinor: monthly(annualTax),
    monthlyNationalInsuranceMinor: monthlyNi,
    monthlyPensionDeductionMinor: pensionDeductionMonthly,
    monthlyPensionGrossMinor: pensionGrossMonthly,
    monthlyTakeHomeMinor:
      monthly(profile.annualSalaryMinor) -
      monthly(annualTax) -
      monthlyNi -
      pensionDeductionMonthly,
    annualTaxablePayMinor: taxableAnnual,
    personalAllowanceMinor: allowance,
    rulesetVersion: rules.version,
    calculatedAt,
  };
}

export const PAY_LIMIT_MINOR = MAX_SALARY_MINOR;
