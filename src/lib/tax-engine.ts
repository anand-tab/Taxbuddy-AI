/**
 * TaxBuddy — Indian Tax Calculation Engine
 * Financial Year 2025-26 (Assessment Year 2026-27)
 *
 * This module provides comprehensive Indian income-tax calculations
 * covering both Old and New regimes, HRA exemption, deduction-based
 * savings suggestions, and filing guidance.
 *
 * All monetary values are in INR (₹).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Detailed salary components for computing exemptions. */
export interface SalaryBreakdown {
  /** Basic salary (annual) */
  basic: number;
  /** House Rent Allowance received (annual) */
  hra: number;
  /** Dearness Allowance (annual) */
  da: number;
  /** Special Allowance (annual) */
  specialAllowance: number;
  /** Leave Travel Allowance (annual) */
  lta: number;
  /** Any other taxable allowances (annual) */
  otherAllowances: number;
}

/** Deductions the taxpayer has claimed / intends to claim (Old Regime). */
export interface Deductions {
  /** Section 80C — PPF, ELSS, EPF, LIC, NSC, SCSS, tuition fees, etc. (max ₹1,50,000) */
  section80C: number;
  /** Section 80D — Health-insurance premium (max ₹25,000; ₹50,000 for senior citizens) */
  section80D: number;
  /** Section 80CCD(1B) — Additional NPS contribution (max ₹50,000) */
  section80CCD1B: number;
  /** Section 80E — Education-loan interest (no statutory limit) */
  section80E: number;
  /** Section 80G — Donations to approved funds */
  section80G: number;
  /** Section 80TTA — Interest on savings accounts (max ₹10,000) */
  section80TTA: number;
  /** Section 24(b) — Home-loan interest (max ₹2,00,000 for self-occupied property) */
  homeLoanInterest: number;
  /** Annual rent paid — used for HRA exemption calculation */
  rentPaid: number;
  /** Whether the taxpayer resides in a metro city (Delhi, Mumbai, Kolkata, Chennai) */
  isMetroCity: boolean;
}

/** Tax computation result for a single regime. */
export interface TaxResult {
  /** Total gross income before any deductions */
  grossIncome: number;
  /** Standard deduction applied */
  standardDeduction: number;
  /** Sum of all chapter VI-A and other deductions (excluding standard deduction) */
  totalDeductions: number;
  /** Itemised deduction amounts keyed by section name */
  deductionBreakdown: Record<string, number>;
  /** Income on which tax is levied */
  taxableIncome: number;
  /** Tax computed on slabs before Section 87A rebate */
  taxBeforeRebate: number;
  /** Rebate under Section 87A */
  rebate87A: number;
  /** Tax after rebate */
  taxAfterRebate: number;
  /** Surcharge amount */
  surcharge: number;
  /** Health & Education Cess (4%) */
  cess: number;
  /** Final tax liability */
  totalTax: number;
  /** Effective tax rate as a percentage of gross income */
  effectiveRate: number;
  /** Breakdown of tax by each slab */
  slabBreakdown: Array<{ slab: string; rate: number; tax: number }>;
}

/** Side-by-side comparison of both tax regimes. */
export interface RegimeComparison {
  /** Full result under the Old Regime */
  oldRegime: TaxResult;
  /** Full result under the New Regime */
  newRegime: TaxResult;
  /** Which regime is better for the taxpayer */
  recommendation: 'old' | 'new';
  /** Absolute savings (always ≥ 0) by picking the recommended regime */
  savings: number;
  /** Human-readable explanation of why a regime is recommended */
  explanation: string;
}

/** A suggestion for additional tax-saving investment / deduction. */
export interface SavingSuggestion {
  /** Tax section (e.g. "80C") */
  section: string;
  /** What this section covers */
  description: string;
  /** Maximum deduction allowed under this section */
  maxLimit: number;
  /** Amount the taxpayer has already claimed */
  currentUsed: number;
  /** Remaining room before hitting the cap */
  remainingRoom: number;
  /** Estimated tax saved if the remaining room is fully utilised */
  potentialSaving: number;
  /** Example investment instruments eligible under the section */
  instruments: string[];
}

/** Age-group classification for exemption-limit purposes. */
export type AgeGroup = 'below60' | '60to80' | 'above80';

/** Guidance on ITR filing for the taxpayer. */
export interface FilingGuidance {
  /** Recommended ITR form (e.g. "ITR-1") */
  itrForm: string;
  /** Why this form is appropriate */
  itrFormReason: string;
  /** Filing due-date for the relevant AY */
  dueDate: string;
  /** Documents the taxpayer should keep ready */
  documentsNeeded: string[];
  /** Step-by-step filing instructions */
  steps: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Old regime basic exemption limits by age group. */
const OLD_REGIME_EXEMPTION: Record<AgeGroup, number> = {
  below60: 250_000,
  '60to80': 300_000,
  above80: 500_000,
};

/** Old regime standard deduction for salaried individuals FY 2025-26. */
const OLD_REGIME_STANDARD_DEDUCTION = 50_000;

/** New regime standard deduction for salaried individuals FY 2025-26. */
const NEW_REGIME_STANDARD_DEDUCTION = 75_000;

/** Deduction caps (annual, INR). */
const DEDUCTION_LIMITS: Record<string, number> = {
  section80C: 150_000,
  section80CCD1B: 50_000,
  section80TTA: 10_000,
  homeLoanInterest: 200_000,
};

/** Section 80D limits by age group. */
const SECTION_80D_LIMIT: Record<AgeGroup, number> = {
  below60: 25_000,
  '60to80': 50_000,
  above80: 50_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute surcharge on income-tax for FY 2025-26.
 *
 * Surcharge rates on income-tax (both regimes):
 * - 10 % when total income > ₹50 lakh and ≤ ₹1 crore
 * - 15 % when total income > ₹1 crore and ≤ ₹2 crore
 * - 25 % when total income > ₹2 crore and ≤ ₹5 crore (old regime)
 * - 37 % when total income > ₹5 crore (old regime)
 *
 * Under the new regime the maximum surcharge rate is capped at 25 %.
 *
 * Marginal relief is applied so that the additional tax (surcharge)
 * does not exceed the additional income above the threshold.
 */
function computeSurcharge(
  taxableIncome: number,
  taxBeforeRebate: number,
  isNewRegime: boolean,
): number {
  if (taxableIncome <= 5_000_000) return 0;

  // Determine applicable surcharge rate and the threshold just below
  let rate: number;
  let threshold: number;

  if (taxableIncome <= 10_000_000) {
    rate = 0.10;
    threshold = 5_000_000;
  } else if (taxableIncome <= 20_000_000) {
    rate = 0.15;
    threshold = 10_000_000;
  } else if (taxableIncome <= 50_000_000) {
    rate = isNewRegime ? 0.25 : 0.25;
    threshold = 20_000_000;
  } else {
    rate = isNewRegime ? 0.25 : 0.37;
    threshold = 50_000_000;
  }

  const surchargeAmount = taxBeforeRebate * rate;

  // Marginal relief: surcharge should not exceed the extra income above the threshold.
  // Compute tax at threshold to figure marginal relief.
  const taxAtThreshold = computeTaxOnSlabs(
    threshold,
    isNewRegime
      ? NEW_REGIME_SLABS
      : getOldRegimeSlabs('below60'), // age-group doesn't matter for marginal-relief diff
  );

  // For marginal relief in surcharge, tax+surcharge at current income should not
  // exceed tax at threshold + (income - threshold).
  // i.e.  surcharge ≤ (taxAtThreshold + (income-threshold)) - taxBeforeRebate
  // But also surcharge ≤ taxBeforeRebate * rate. We take the minimum.
  // However, if threshold rate is also surcharge-bearing we need to include that.
  // Standard approach: tax+surcharge ≤ tax_at_threshold + surcharge_at_threshold + (income - threshold)
  // For simplicity and correctness, compute previous-bracket surcharge on taxAtThreshold:
  let surchargeAtThreshold = 0;
  if (threshold === 10_000_000) {
    surchargeAtThreshold = taxAtThreshold * 0.10;
  } else if (threshold === 20_000_000) {
    surchargeAtThreshold = taxAtThreshold * 0.15;
  } else if (threshold === 50_000_000) {
    surchargeAtThreshold = taxAtThreshold * 0.25;
  }

  const totalAtThreshold = taxAtThreshold + surchargeAtThreshold;
  const totalCurrent = taxBeforeRebate + surchargeAmount;
  const excessIncome = taxableIncome - threshold;

  if (totalCurrent > totalAtThreshold + excessIncome) {
    // Apply marginal relief
    const marginalSurcharge = Math.max(
      0,
      totalAtThreshold + excessIncome - taxBeforeRebate,
    );
    return Math.round(marginalSurcharge);
  }

  return Math.round(surchargeAmount);
}

/**
 * Compute tax by applying a slab schedule to the taxable income.
 * Each slab is `{ upTo, rate }` where `upTo` is the upper bound (Infinity for the last bracket).
 */
function computeTaxOnSlabs(
  taxableIncome: number,
  slabs: Array<{ upTo: number; rate: number }>,
): number {
  let remaining = taxableIncome;
  let tax = 0;
  let prevLimit = 0;

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const width = slab.upTo - prevLimit;
    const taxable = Math.min(remaining, width);
    tax += taxable * slab.rate;
    remaining -= taxable;
    prevLimit = slab.upTo;
  }

  return Math.round(tax);
}

/**
 * Build slab-breakdown array for display purposes.
 */
function buildSlabBreakdown(
  taxableIncome: number,
  slabs: Array<{ upTo: number; rate: number }>,
): Array<{ slab: string; rate: number; tax: number }> {
  const breakdown: Array<{ slab: string; rate: number; tax: number }> = [];
  let remaining = taxableIncome;
  let prevLimit = 0;

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const width = slab.upTo === Infinity ? remaining : slab.upTo - prevLimit;
    const taxable = Math.min(remaining, width);
    const tax = Math.round(taxable * slab.rate);

    const lower = formatCurrency(prevLimit + 1);
    const upper =
      slab.upTo === Infinity
        ? 'Above'
        : formatCurrency(slab.upTo);
    const label =
      slab.upTo === Infinity
        ? `Above ${formatCurrency(prevLimit)}`
        : `${lower} – ${upper}`;

    breakdown.push({ slab: label, rate: slab.rate * 100, tax });
    remaining -= taxable;
    prevLimit = slab.upTo;
  }

  return breakdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slab Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** FY 2025-26 New Regime slabs (applicable regardless of age). */
const NEW_REGIME_SLABS: Array<{ upTo: number; rate: number }> = [
  { upTo: 400_000, rate: 0.00 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.10 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.20 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

/** Returns Old Regime slabs for FY 2025-26 based on age group. */
function getOldRegimeSlabs(
  ageGroup: AgeGroup,
): Array<{ upTo: number; rate: number }> {
  const exemption = OLD_REGIME_EXEMPTION[ageGroup];

  // For super-seniors (above 80), there is no 5 % slab — 0 % up to 5L directly.
  if (ageGroup === 'above80') {
    return [
      { upTo: 500_000, rate: 0.00 },
      { upTo: 1_000_000, rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ];
  }

  return [
    { upTo: exemption, rate: 0.00 },
    { upTo: 500_000, rate: 0.05 },
    { upTo: 1_000_000, rate: 0.20 },
    { upTo: Infinity, rate: 0.30 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HRA Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate HRA exemption under Section 10(13A).
 *
 * The exemption is the **minimum** of:
 * 1. Actual HRA received from employer
 * 2. Rent paid − 10 % of (Basic + DA)
 * 3. 50 % of (Basic + DA) for metro cities; 40 % otherwise
 *
 * @param basic    Annual basic salary
 * @param hraReceived Annual HRA received
 * @param rentPaid Annual rent paid
 * @param isMetroCity Whether the city is a metro (Delhi, Mumbai, Kolkata, Chennai)
 * @returns Exemption amount and itemised breakdown
 */
export function calculateHRA(
  basic: number,
  hraReceived: number,
  rentPaid: number,
  isMetroCity: boolean,
): {
  exemption: number;
  breakdown: {
    actualHRA: number;
    rentMinus10Basic: number;
    percentOfBasic: number;
  };
} {
  const actualHRA = hraReceived;
  const rentMinus10Basic = Math.max(0, rentPaid - 0.10 * basic);
  const percentOfBasic = isMetroCity ? 0.50 * basic : 0.40 * basic;

  const exemption = Math.max(
    0,
    Math.min(actualHRA, rentMinus10Basic, percentOfBasic),
  );

  return {
    exemption: Math.round(exemption),
    breakdown: {
      actualHRA: Math.round(actualHRA),
      rentMinus10Basic: Math.round(rentMinus10Basic),
      percentOfBasic: Math.round(percentOfBasic),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduction Computation (Old Regime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute capped deductions for the Old Regime and return both the total and
 * an itemised breakdown.
 */
function computeOldRegimeDeductions(
  deductions: Deductions,
  salaryBreakdown: SalaryBreakdown,
  ageGroup: AgeGroup,
): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  // Section 80C — capped at ₹1,50,000
  breakdown['Section 80C'] = Math.min(deductions.section80C, 150_000);

  // Section 80D — capped at ₹25,000 (₹50,000 for senior / super-senior)
  const limit80D = SECTION_80D_LIMIT[ageGroup];
  breakdown['Section 80D'] = Math.min(deductions.section80D, limit80D);

  // Section 80CCD(1B) — capped at ₹50,000
  breakdown['Section 80CCD(1B)'] = Math.min(deductions.section80CCD1B, 50_000);

  // Section 80E — no upper limit
  breakdown['Section 80E'] = deductions.section80E;

  // Section 80G — taken at face value (assumes pre-validated)
  breakdown['Section 80G'] = deductions.section80G;

  // Section 80TTA — capped at ₹10,000
  breakdown['Section 80TTA'] = Math.min(deductions.section80TTA, 10_000);

  // Section 24(b) — Home loan interest, capped at ₹2,00,000
  breakdown['Section 24(b) Home Loan Interest'] = Math.min(
    deductions.homeLoanInterest,
    200_000,
  );

  // HRA exemption under Section 10(13A)
  if (deductions.rentPaid > 0 && salaryBreakdown.hra > 0) {
    const hraResult = calculateHRA(
      salaryBreakdown.basic + salaryBreakdown.da,
      salaryBreakdown.hra,
      deductions.rentPaid,
      deductions.isMetroCity,
    );
    breakdown['HRA Exemption (Section 10(13A))'] = hraResult.exemption;
  }

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { total, breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Old Regime Tax Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate income-tax under the **Old Regime** for FY 2025-26.
 *
 * @param grossIncome      Total gross income (salary + other sources)
 * @param deductions       Deduction amounts claimed by the taxpayer
 * @param salaryBreakdown  Salary component split for HRA computation
 * @param ageGroup         Taxpayer's age group for exemption limits
 * @returns Full tax computation result
 */
export function calculateOldRegimeTax(
  grossIncome: number,
  deductions: Deductions,
  salaryBreakdown: SalaryBreakdown,
  ageGroup: AgeGroup,
): TaxResult {
  const standardDeduction = OLD_REGIME_STANDARD_DEDUCTION;

  // Compute deductions (chapter VI-A + HRA + Sec 24)
  const { total: totalDeductions, breakdown: deductionBreakdown } =
    computeOldRegimeDeductions(deductions, salaryBreakdown, ageGroup);

  // Taxable income
  const taxableIncome = Math.max(
    0,
    grossIncome - standardDeduction - totalDeductions,
  );

  // Tax on slabs
  const slabs = getOldRegimeSlabs(ageGroup);
  const taxBeforeRebate = computeTaxOnSlabs(taxableIncome, slabs);
  const slabBreakdown = buildSlabBreakdown(taxableIncome, slabs);

  // Section 87A rebate — if taxable income ≤ ₹5,00,000 the tax is nil
  const rebate87A =
    taxableIncome <= 500_000 ? taxBeforeRebate : 0;
  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate87A);

  // Surcharge
  const surcharge =
    taxAfterRebate > 0
      ? computeSurcharge(taxableIncome, taxAfterRebate, false)
      : 0;

  // Health & Education Cess — 4 % on (tax + surcharge)
  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);

  const totalTax = taxAfterRebate + surcharge + cess;
  const effectiveRate =
    grossIncome > 0
      ? parseFloat(((totalTax / grossIncome) * 100).toFixed(2))
      : 0;

  return {
    grossIncome,
    standardDeduction,
    totalDeductions,
    deductionBreakdown,
    taxableIncome,
    taxBeforeRebate,
    rebate87A,
    taxAfterRebate,
    surcharge,
    cess,
    totalTax,
    effectiveRate,
    slabBreakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// New Regime Tax Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate income-tax under the **New Regime** for FY 2025-26.
 *
 * The new (default) regime offers lower slab rates but does **not** allow
 * most deductions and exemptions (HRA, 80C, 80D, etc.).
 * Only the standard deduction of ₹75,000 is available.
 *
 * Rebate u/s 87A: If taxable income ≤ ₹12,75,000 the tax is nil.
 * Marginal relief ensures that a taxpayer whose income is just above the
 * rebate threshold does not pay more tax than the excess over ₹12,75,000.
 *
 * @param grossIncome Total gross income
 * @param ageGroup    Taxpayer's age group (slabs are age-independent in new regime)
 * @returns Full tax computation result
 */
export function calculateNewRegimeTax(
  grossIncome: number,
  ageGroup: AgeGroup,
): TaxResult {
  const standardDeduction = NEW_REGIME_STANDARD_DEDUCTION;

  // No deductions available under new regime
  const totalDeductions = 0;
  const deductionBreakdown: Record<string, number> = {};

  const taxableIncome = Math.max(0, grossIncome - standardDeduction);

  // Tax on slabs
  const taxBeforeRebate = computeTaxOnSlabs(taxableIncome, NEW_REGIME_SLABS);
  const slabBreakdown = buildSlabBreakdown(taxableIncome, NEW_REGIME_SLABS);

  // Section 87A rebate — if taxable income ≤ ₹12,75,000, full rebate
  const REBATE_THRESHOLD = 1_275_000;
  let rebate87A = 0;
  let taxAfterRebate = taxBeforeRebate;

  if (taxableIncome <= REBATE_THRESHOLD) {
    rebate87A = taxBeforeRebate;
    taxAfterRebate = 0;
  } else {
    // Marginal relief: tax payable should not exceed (taxableIncome − REBATE_THRESHOLD)
    const excessOverThreshold = taxableIncome - REBATE_THRESHOLD;
    if (taxBeforeRebate > excessOverThreshold) {
      rebate87A = taxBeforeRebate - excessOverThreshold;
      taxAfterRebate = excessOverThreshold;
    }
  }

  taxAfterRebate = Math.max(0, taxAfterRebate);

  // Surcharge (new regime caps surcharge at 25 %)
  const surcharge =
    taxAfterRebate > 0
      ? computeSurcharge(taxableIncome, taxAfterRebate, true)
      : 0;

  // Cess — 4 %
  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);

  const totalTax = taxAfterRebate + surcharge + cess;
  const effectiveRate =
    grossIncome > 0
      ? parseFloat(((totalTax / grossIncome) * 100).toFixed(2))
      : 0;

  return {
    grossIncome,
    standardDeduction,
    totalDeductions,
    deductionBreakdown,
    taxableIncome,
    taxBeforeRebate,
    rebate87A,
    taxAfterRebate,
    surcharge,
    cess,
    totalTax,
    effectiveRate,
    slabBreakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regime Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare the Old and New regimes side-by-side and recommend the one with
 * the lower total tax liability.
 *
 * @param grossIncome      Total gross income
 * @param deductions       Deduction inputs
 * @param salaryBreakdown  Salary split
 * @param ageGroup         Taxpayer's age group
 * @returns Comparison object with recommendation and savings
 */
export function compareRegimes(
  grossIncome: number,
  deductions: Deductions,
  salaryBreakdown: SalaryBreakdown,
  ageGroup: AgeGroup,
): RegimeComparison {
  const oldRegime = calculateOldRegimeTax(
    grossIncome,
    deductions,
    salaryBreakdown,
    ageGroup,
  );
  const newRegime = calculateNewRegimeTax(grossIncome, ageGroup);

  const recommendation: 'old' | 'new' =
    oldRegime.totalTax <= newRegime.totalTax ? 'old' : 'new';

  const savings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

  let explanation: string;

  if (recommendation === 'old') {
    explanation =
      `The Old Regime saves you ${formatCurrency(savings)} compared to the New Regime. ` +
      `Your total deductions of ${formatCurrency(oldRegime.totalDeductions)} (plus the ₹50,000 standard deduction) ` +
      `more than offset the wider nil-tax slab of the New Regime. ` +
      `Effective tax rate: Old ${oldRegime.effectiveRate}% vs New ${newRegime.effectiveRate}%.`;
  } else if (savings === 0) {
    explanation =
      'Both regimes result in the same tax liability. ' +
      'The New Regime is recommended as the default since it requires less paperwork and fewer proofs.';
  } else {
    explanation =
      `The New Regime saves you ${formatCurrency(savings)} compared to the Old Regime. ` +
      `Your current deductions of ${formatCurrency(oldRegime.totalDeductions)} are not large enough ` +
      `to beat the lower slab rates and higher standard deduction (₹75,000) of the New Regime. ` +
      `Effective tax rate: New ${newRegime.effectiveRate}% vs Old ${oldRegime.effectiveRate}%.`;
  }

  return { oldRegime, newRegime, recommendation, savings, explanation };
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings Suggestions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyse the taxpayer's current deduction utilisation and suggest additional
 * investments / expenses that can reduce tax under the Old Regime.
 *
 * Suggestions are sorted by potential tax savings (highest first).
 *
 * @param grossIncome       Total gross income
 * @param currentDeductions Current deduction amounts
 * @param ageGroup          Taxpayer's age group
 * @returns Array of saving suggestions, sorted descending by potential savings
 */
export function suggestSavings(
  grossIncome: number,
  currentDeductions: Deductions,
  ageGroup: AgeGroup,
): SavingSuggestion[] {
  const suggestions: SavingSuggestion[] = [];

  // Determine the taxpayer's marginal tax rate (old regime) for estimating savings.
  // We approximate by computing tax with and without an extra ₹1 of deduction.
  const dummySalary: SalaryBreakdown = {
    basic: 0,
    hra: 0,
    da: 0,
    specialAllowance: 0,
    lta: 0,
    otherAllowances: 0,
  };
  const baseResult = calculateOldRegimeTax(
    grossIncome,
    currentDeductions,
    dummySalary,
    ageGroup,
  );

  // Estimate marginal rate from the last slab hit
  let marginalRate = 0;
  const taxableIncome = baseResult.taxableIncome;
  const exemption = OLD_REGIME_EXEMPTION[ageGroup];

  if (taxableIncome > 1_000_000) marginalRate = 0.30;
  else if (taxableIncome > 500_000) marginalRate = 0.20;
  else if (taxableIncome > exemption) marginalRate = 0.05;

  // Include cess & surcharge approximation (cess = 4 %)
  const effectiveMarginal = marginalRate * 1.04;

  // ── Section 80C ──
  const limit80C = 150_000;
  const used80C = Math.min(currentDeductions.section80C, limit80C);
  const room80C = limit80C - used80C;
  if (room80C > 0) {
    suggestions.push({
      section: '80C',
      description:
        'Investments in PPF, ELSS mutual funds, EPF, LIC premiums, NSC, SCSS, 5-yr FD, tuition fees, home-loan principal',
      maxLimit: limit80C,
      currentUsed: used80C,
      remainingRoom: room80C,
      potentialSaving: Math.round(room80C * effectiveMarginal),
      instruments: [
        'PPF (Public Provident Fund)',
        'ELSS Mutual Funds',
        'EPF (Employee Provident Fund)',
        'LIC Premium',
        'NSC (National Savings Certificate)',
        'SCSS (Senior Citizen Savings Scheme)',
        '5-Year Tax-Saving FD',
        'Sukanya Samriddhi Yojana',
        "Children's Tuition Fees",
        'Home Loan Principal Repayment',
      ],
    });
  }

  // ── Section 80D ──
  const limit80D = SECTION_80D_LIMIT[ageGroup];
  const used80D = Math.min(currentDeductions.section80D, limit80D);
  const room80D = limit80D - used80D;
  if (room80D > 0) {
    suggestions.push({
      section: '80D',
      description:
        'Health insurance premium for self, spouse, children, and parents. Includes preventive health check-up (₹5,000 within overall limit).',
      maxLimit: limit80D,
      currentUsed: used80D,
      remainingRoom: room80D,
      potentialSaving: Math.round(room80D * effectiveMarginal),
      instruments: [
        'Health Insurance (Self & Family)',
        'Health Insurance (Parents)',
        'Preventive Health Check-up',
      ],
    });
  }

  // ── Section 80CCD(1B) ──
  const limit80CCD = 50_000;
  const used80CCD = Math.min(currentDeductions.section80CCD1B, limit80CCD);
  const room80CCD = limit80CCD - used80CCD;
  if (room80CCD > 0) {
    suggestions.push({
      section: '80CCD(1B)',
      description:
        'Additional contribution to National Pension System (NPS) over and above Section 80C limit',
      maxLimit: limit80CCD,
      currentUsed: used80CCD,
      remainingRoom: room80CCD,
      potentialSaving: Math.round(room80CCD * effectiveMarginal),
      instruments: ['NPS Tier-I Account'],
    });
  }

  // ── Section 80TTA ──
  const limit80TTA = 10_000;
  const used80TTA = Math.min(currentDeductions.section80TTA, limit80TTA);
  const room80TTA = limit80TTA - used80TTA;
  if (room80TTA > 0) {
    suggestions.push({
      section: '80TTA',
      description:
        'Interest earned on savings bank accounts (not FDs). Up to ₹10,000 is deductible.',
      maxLimit: limit80TTA,
      currentUsed: used80TTA,
      remainingRoom: room80TTA,
      potentialSaving: Math.round(room80TTA * effectiveMarginal),
      instruments: ['Savings Bank Account Interest'],
    });
  }

  // ── Section 24(b) — Home Loan Interest ──
  const limitHL = 200_000;
  const usedHL = Math.min(currentDeductions.homeLoanInterest, limitHL);
  const roomHL = limitHL - usedHL;
  if (roomHL > 0) {
    suggestions.push({
      section: '24(b)',
      description:
        'Interest paid on home loan for self-occupied property (up to ₹2,00,000). No limit for let-out property.',
      maxLimit: limitHL,
      currentUsed: usedHL,
      remainingRoom: roomHL,
      potentialSaving: Math.round(roomHL * effectiveMarginal),
      instruments: ['Home Loan Interest (Self-Occupied Property)'],
    });
  }

  // ── Section 80E — Education Loan ──
  if (currentDeductions.section80E === 0) {
    suggestions.push({
      section: '80E',
      description:
        'Interest on education loan for higher studies. The entire interest amount is deductible for up to 8 years. No upper limit.',
      maxLimit: Infinity,
      currentUsed: 0,
      remainingRoom: Infinity,
      potentialSaving: 0, // cannot estimate without loan details
      instruments: ['Education Loan Interest'],
    });
  }

  // Sort by potential saving (descending), filtering out zero-saving items last
  suggestions.sort((a, b) => b.potentialSaving - a.potentialSaving);

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filing Guidance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the correct ITR form, due date, required documents, and
 * step-by-step filing instructions for a taxpayer.
 *
 * @param hasMultipleIncomes  Salary from more than one employer, or income from other sources
 * @param hasCapitalGains     Income from capital gains (stocks, property, etc.)
 * @param hasBusinessIncome   Income from business or profession
 * @param hasForeignIncome    Income from foreign sources or foreign assets
 * @returns Filing guidance object
 */
export function getFilingGuidance(
  hasMultipleIncomes: boolean,
  hasCapitalGains: boolean,
  hasBusinessIncome: boolean,
  hasForeignIncome: boolean,
): FilingGuidance {
  let itrForm: string;
  let itrFormReason: string;

  if (hasForeignIncome) {
    itrForm = 'ITR-2';
    itrFormReason =
      'You have foreign income or foreign assets, which requires ITR-2 (or ITR-3 if you also have business income).';
    if (hasBusinessIncome) {
      itrForm = 'ITR-3';
      itrFormReason =
        'You have both foreign income/assets and business/professional income, requiring ITR-3.';
    }
  } else if (hasBusinessIncome) {
    itrForm = 'ITR-3';
    itrFormReason =
      'You have income from business or profession. ITR-3 is required for individuals/HUFs with business income (non-presumptive). ' +
      'If your business opts for presumptive taxation (Sections 44AD/44ADA/44AE), ITR-4 (Sugam) may be used instead.';
  } else if (hasCapitalGains) {
    itrForm = 'ITR-2';
    itrFormReason =
      'You have capital gains income. ITR-1 (Sahaj) does not support capital gains, so ITR-2 is required.';
  } else if (hasMultipleIncomes) {
    // Multiple salary sources or other income but no cap gains / business / foreign
    itrForm = 'ITR-1';
    itrFormReason =
      'ITR-1 (Sahaj) is suitable for resident individuals with total income up to ₹50 lakh from salary, ' +
      'one house property, other sources (interest, etc.), and agricultural income up to ₹5,000. ' +
      'If total income exceeds ₹50 lakh, use ITR-2.';
  } else {
    itrForm = 'ITR-1';
    itrFormReason =
      'ITR-1 (Sahaj) is the simplest form for salaried individuals with income from salary, ' +
      'one house property, and other sources (interest, dividends ≤ ₹5,000, family pension). ' +
      'Total income must be ≤ ₹50 lakh.';
  }

  const dueDate = '31st July 2026';

  // Build document list
  const documentsNeeded: string[] = [
    'PAN Card',
    'Aadhaar Card',
    'Form 16 (from employer)',
    'Form 26AS (Tax Credit Statement)',
    'AIS (Annual Information Statement)',
    'Bank statements for interest income',
    'Savings account interest certificates',
  ];

  if (hasCapitalGains) {
    documentsNeeded.push(
      'Capital gains statement from broker / DEMAT',
      'Property sale/purchase deed (if applicable)',
      'Cost of acquisition documents',
    );
  }

  if (hasBusinessIncome) {
    documentsNeeded.push(
      'Profit & Loss Account',
      'Balance Sheet',
      'Books of Accounts',
      'GST returns (if applicable)',
      'TDS certificates from clients',
    );
  }

  if (hasForeignIncome) {
    documentsNeeded.push(
      'Foreign income details & tax residency certificate',
      'Schedule FA (Foreign Assets) details',
      'DTAA relief computation (if applicable)',
    );
  }

  documentsNeeded.push(
    'Investment proofs for Section 80C (PPF, ELSS, LIC, etc.)',
    'Health insurance premium receipts (Section 80D)',
    'Home loan interest certificate (if applicable)',
    'Rent receipts / rental agreement (for HRA exemption)',
    'NPS contribution receipt (Section 80CCD(1B))',
  );

  const steps: string[] = [
    'Collect all salary slips, Form 16, Form 26AS, AIS/TIS from the income-tax portal.',
    'Compute total income from all sources (salary, house property, other sources, capital gains, business).',
    `Select the correct ITR form (${itrForm}) on the e-filing portal (https://eportal.incometax.gov.in).`,
    'Choose the tax regime — Old or New — based on which yields lower tax.',
    'Fill in personal details, income details, and deduction claims.',
    'Verify Form 26AS / AIS to ensure TDS credits are correctly reflected.',
    'Calculate tax payable; pay any self-assessment tax (Challan 280) before filing.',
    'Validate all entries using the built-in validation utility on the portal.',
    'Submit the return and e-verify via Aadhaar OTP, net banking, or DSC within 30 days.',
    'Download the ITR-V acknowledgement for your records.',
  ];

  return { itrForm, itrFormReason, dueDate, documentsNeeded, steps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency Formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a number as Indian currency with the ₹ symbol and the Indian
 * numbering system (lakhs & crores).
 *
 * @example formatCurrency(1234567) // "₹12,34,567"
 * @example formatCurrency(-4500)   // "−₹4,500"
 */
export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const str = abs.toString();

  if (str.length <= 3) {
    return `${isNegative ? '−' : ''}₹${str}`;
  }

  // Last 3 digits
  const last3 = str.slice(-3);
  let remaining = str.slice(0, -3);

  // Group remaining digits in pairs (Indian system)
  const groups: string[] = [];
  while (remaining.length > 2) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    groups.unshift(remaining);
  }

  const formatted = `${groups.join(',')},${last3}`;
  return `${isNegative ? '−' : ''}₹${formatted}`;
}
