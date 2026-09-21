import type { TaxYear } from "./types";

export const PAY_RULES = {
  "2025/26": {
    version: "uk-rUK-2025-26-v1",
    verifiedAt: "2026-09-21",
    personalAllowanceMinor: 1_257_000,
    allowanceTaperStartsMinor: 10_000_000,
    basicBandMinor: 3_770_000,
    additionalThresholdMinor: 12_514_000,
    niPrimaryMonthlyMinor: 104_800,
    niUpperMonthlyMinor: 418_900,
  },
  "2026/27": {
    version: "uk-rUK-2026-27-v1",
    verifiedAt: "2026-09-21",
    personalAllowanceMinor: 1_257_000,
    allowanceTaperStartsMinor: 10_000_000,
    basicBandMinor: 3_770_000,
    additionalThresholdMinor: 12_514_000,
    niPrimaryMonthlyMinor: 104_800,
    niUpperMonthlyMinor: 418_900,
  },
} as const satisfies Record<TaxYear, object>;

export const PAY_SOURCES = [
  "https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past",
  "https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027",
  "https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026",
  "https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief",
] as const;
