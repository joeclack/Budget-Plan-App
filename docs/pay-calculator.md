# Take-home calculator

## Supported calculation

The calculator estimates monthly take-home pay for one employment in England, Wales or Northern Ireland. It supports tax years 2025/26 and 2026/27, the standard personal allowance, the allowance taper above £100,000, the basic/higher/additional income-tax bands and employee National Insurance category A on monthly pay.

The pension percentage always applies to the whole annual salary. The selected method controls the calculation:

- Net pay deducts the gross pension contribution before income tax, but not before National Insurance.
- Relief at source deducts 80% of the gross contribution from take-home pay and records the provider's basic-rate top-up. Higher-rate relief that must be claimed separately is not added to the estimate.
- Salary sacrifice reduces both taxable pay and National Insurance pay by the sacrificed gross contribution.

Amounts are integer pence. Percentage operations and conversion from annual to monthly values round to the nearest penny. The calculation is an estimate rather than a payroll engine, so payroll-period rounding can differ by a few pence.

The estimate excludes Scottish income tax, student loans, benefits, bonuses, multiple jobs, employer pension contributions, tax-code adjustments and other payroll deductions.

## Applying an estimate

The user explicitly chooses an income row in an unlocked saved month. Applying replaces that row's rule with the calculated fixed monthly take-home amount. The row update and an immutable snapshot of the inputs, result, ruleset version and calculation time commit together. It does not change another month or a template.

## Rules and sources

Ruleset constants live in `src/domain/pay/rules.ts`. Each result records a ruleset version and calculation time. The constants were checked on 21 September 2026 against:

- [Income Tax rates and allowances](https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past)
- [Rates and thresholds for employers: 2026 to 2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027)
- [Rates and thresholds for employers: 2025 to 2026](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026)
- [Tax on a private pension: pension tax relief](https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief)
