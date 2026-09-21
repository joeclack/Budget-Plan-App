export type TaxYear = "2025/26" | "2026/27";
export type PensionMethod = "net_pay" | "relief_at_source" | "salary_sacrifice";
export type PayCountry = "england" | "wales" | "northern_ireland";

export type PayProfile = {
  id: "primary";
  annualSalaryMinor: number;
  pensionRateBps: number;
  pensionMethod: PensionMethod;
  pensionBasis: "whole_salary";
  country: PayCountry;
  taxYear: TaxYear;
  updatedAt: string;
};

export type PayEstimate = {
  annualSalaryMinor: number;
  monthlyGrossMinor: number;
  monthlyTaxMinor: number;
  monthlyNationalInsuranceMinor: number;
  monthlyPensionDeductionMinor: number;
  monthlyPensionGrossMinor: number;
  monthlyTakeHomeMinor: number;
  annualTaxablePayMinor: number;
  personalAllowanceMinor: number;
  rulesetVersion: string;
  calculatedAt: string;
};

export type PayEstimateSnapshot = {
  id: string;
  budgetRowId: string;
  inputs: PayProfile;
  result: PayEstimate;
  rulesetVersion: string;
  calculatedAt: string;
};
