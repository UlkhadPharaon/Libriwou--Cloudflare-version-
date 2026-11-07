/**
 * Fiscal engine unit tests (Phase 2.2).
 *
 * Coverage target: >= 80% of `src/lib/tax-rules.ts` (the critical core of the product).
 * Run with `npm test`.
 *
 * These tests LOCK IN the current arithmetic. If a value below looks wrong, it is a
 * documented behaviour change request — not a silent regression. See FINAL_ENGINEERING_REPORT.md.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTaxes,
  calculatePayroll,
  determineTaxRegime,
  TaxRegime,
} from './tax-rules.js';

// Tolerance for floating point (F CFA)
const T = 0.01;

describe('determineTaxRegime', () => {
  it('classifies CME below 15M FCFA', () => {
    expect(determineTaxRegime(0)).toBe('CME');
    expect(determineTaxRegime(1)).toBe('CME');
    expect(determineTaxRegime(14_999_999)).toBe('CME');
  });

  it('classifies RSI between 15M and 50M FCFA inclusive', () => {
    expect(determineTaxRegime(15_000_000)).toBe('RSI');
    expect(determineTaxRegime(30_000_000)).toBe('RSI');
    expect(determineTaxRegime(50_000_000)).toBe('RSI');
  });

  it('classifies RNI strictly above 50M FCFA', () => {
    expect(determineTaxRegime(50_000_001)).toBe('RNI');
    expect(determineTaxRegime(500_000_000)).toBe('RNI');
  });
});

describe('calculatePayroll', () => {
  it('returns all zeros for a zero salary', () => {
    const p = calculatePayroll(0);
    expect(p.grossSalary).toBe(0);
    expect(p.cnssEmployee).toBe(0);
    expect(p.iuts).toBe(0);
    expect(p.netSalary).toBe(0);
    expect(p.cnssEmployer).toBe(0);
    expect(p.totalEmployerCost).toBe(0);
  });

  it('applies CNSS employee 5.5% and employer 19.5%', () => {
    const p = calculatePayroll(200_000);
    expect(p.cnssEmployee).toBeCloseTo(11_000, 5); // 5.5%
    expect(p.cnssEmployer).toBeCloseTo(39_000, 5); // 16% + 3.5% family
    expect(p.totalEmployerCost).toBeCloseTo(239_000, 5);
  });

  it('applies the lowest IUTS bracket only below 30k net base', () => {
    // iutsBase = 28,350 → below the 30,000 threshold → no IUTS at all
    const p = calculatePayroll(30_000);
    expect(p.iuts).toBe(0);
    expect(p.netSalary).toBeCloseTo(28_350, 5);
  });

  it('applies the 12.1% bracket for a low salary', () => {
    // gross 100,000 → iutsBase 94,500 (> 80,000 branch):
    //   (94,500 - 80,000) * 0.157  = 2,276.5
    //   (80,000 - 50,000) * 0.139  = 4,170
    //   (50,000 - 30,000) * 0.121  = 2,420
    //   total                     = 8,866.5
    const p = calculatePayroll(100_000);
    expect(p.iuts).toBeCloseTo(8_866.5, 5);
    expect(p.netSalary).toBeCloseTo(85_633.5, 5);
  });

  it('applies every progressive bracket for a high salary', () => {
    // gross 300,000 → iutsBase 283,500, all six brackets hit
    const p = calculatePayroll(300_000);
    expect(p.iuts).toBeCloseTo(47_725, 5);
    expect(p.netSalary).toBeCloseTo(235_775, 5);
    expect(p.totalEmployerCost).toBeCloseTo(358_500, 5);
  });

  it('guards against a negative gross salary', () => {
    // CNSS employee becomes negative, so it is subtracted back: net = -100,000 + 5,500
    const p = calculatePayroll(-100_000);
    expect(p.iuts).toBe(0);
    expect(p.netSalary).toBeCloseTo(-94_500, 5);
  });

  it.each([
    // [gross, iutsBase, expected iuts] — one case per progressive bracket boundary
    [40_000, 37_800, 943.8], // 30k–50k bracket (12.1%)
    [60_000, 56_700, 3_351.3], // 50k–80k bracket (13.9% + 12.1%)
    [100_000, 94_500, 8_866.5], // 80k–120k bracket (15.7% + 13.9% + 12.1%)
    [150_000, 141_750, 16_872.0], // 120k–170k bracket (18.4% + ...)
    [200_000, 189_000, 26_174.0], // 170k–250k bracket (21.6% + ...)
    [300_000, 283_500, 47_725.0], // above 250k (25% + ...)
  ])('computes IUTS for gross %i (base %i)', (gross, base, expectedIuts) => {
    const p = calculatePayroll(gross);
    expect(p.iuts).toBeCloseTo(expectedIuts, 5);
    // net = gross - CNSS(5.5%) - IUTS, in every bracket
    expect(p.netSalary).toBeCloseTo(gross * 0.945 - expectedIuts, 5);
  });

  it('keeps the IUTS monotonic (more gross → more tax, never less)', () => {
    const samples = [30_000, 40_000, 60_000, 100_000, 150_000, 200_000, 300_000, 600_000];
    const taxes = samples.map((s) => calculatePayroll(s).iuts);
    for (let i = 1; i < taxes.length; i++) {
      expect(taxes[i]).toBeGreaterThanOrEqual(taxes[i - 1]);
    }
  });
});

describe('calculateTaxes — CME (micro-entreprise)', () => {
  it('computes 5% on revenue for services, with no TVA and no IS', () => {
    const r = calculateTaxes(5_000_000, 2_000_000, 'CME', true);
    expect(r.regime).toBe('CME');
    expect(r.cmeAmount).toBeCloseTo(250_000, 5); // 5% of 5M
    expect(r.tvaAmount).toBe(0);
    expect(r.isAmount).toBe(0);
    expect(r.netIncome).toBeCloseTo(2_750_000, 5);
  });

  it('computes 2% on revenue for goods', () => {
    const r = calculateTaxes(5_000_000, 2_000_000, 'CME', false);
    expect(r.cmeAmount).toBeCloseTo(100_000, 5); // 2% of 5M
    expect(r.tvaAmount).toBe(0);
    expect(r.isAmount).toBe(0);
    expect(r.netIncome).toBeCloseTo(2_900_000, 5);
  });

  it('ignores expenses entirely (CME is a turnover tax, not a profit tax)', () => {
    const cheap = calculateTaxes(5_000_000, 0, 'CME', true);
    const expensive = calculateTaxes(5_000_000, 4_999_999, 'CME', true);
    expect(cheap.cmeAmount).toBeCloseTo(expensive.cmeAmount, 5);
  });

  it('levies nothing on a zero revenue', () => {
    const r = calculateTaxes(0, 2_000_000, 'CME', true);
    expect(r.cmeAmount).toBe(0);
    expect(r.netIncome).toBe(0);
  });
});

describe('calculateTaxes — RSI / RNI (TVA + IS)', () => {
  it('computes TVA net collected and IS at 27.5% of profit', () => {
    const r = calculateTaxes(20_000_000, 5_000_000, 'RSI', true);
    expect(r.tvaAmount).toBeCloseTo(2_700_000, 5); // (20M - 5M) * 18%
    expect(r.isAmount).toBeCloseTo(4_125_000, 5); // 15M profit * 27.5%
    // netIncome deducts IS only: TVA is collected on behalf of the state (pass-through),
    // it is not a charge of the company.
    expect(r.netIncome).toBeCloseTo(10_875_000, 5);
  });

  it('excludes TVA from netIncome because it is a state pass-through', () => {
    const r = calculateTaxes(20_000_000, 5_000_000, 'RSI', true);
    const profit = 15_000_000;
    // If TVA were deducted, netIncome would be 2.7M lower.
    expect(r.netIncome).toBeCloseTo(profit - r.isAmount, 5);
    expect(r.netIncome).toBeCloseTo(profit - r.isAmount - r.tvaAmount + r.tvaAmount, 5);
    expect(r.netIncome - (profit - r.isAmount - r.tvaAmount)).toBeCloseTo(r.tvaAmount, 5);
  });

  it('applies the RSI MFP floor (300k) when profit is too small', () => {
    // profit = 1M → IS = 275k, below the 300k plancher → floor applies
    const r = calculateTaxes(20_000_000, 19_000_000, 'RSI', true);
    expect(r.isAmount).toBeCloseTo(300_000, 5);
    expect(r.netIncome).toBeCloseTo(700_000, 5); // 1M profit - 300k IS
  });

  it('applies the RNI MFP floor (1M) when profit is too small', () => {
    const r = calculateTaxes(200_000_000, 195_000_000, 'RNI', true);
    // profit = 5M → IS = 1,375,000 > 1M plancher → calculated IS wins
    expect(r.isAmount).toBeCloseTo(1_375_000, 5);
  });

  it('levies no IS on a zero revenue even when the MFP exists', () => {
    const r = calculateTaxes(0, 5_000_000, 'RSI', true);
    expect(r.isAmount).toBe(0);
    // TVA on pure expenses would be negative → clamped to 0
    expect(r.tvaAmount).toBe(0);
    expect(r.netIncome).toBe(0);
  });

  it('clamps a negative TVA credit to zero (deductible > collected)', () => {
    const r = calculateTaxes(10_000_000, 12_000_000, 'RSI', true);
    expect(r.tvaAmount).toBe(0);
    // profit is 0, so the MFP floor of 300k still applies
    expect(r.isAmount).toBeCloseTo(300_000, 5);
    expect(r.netIncome).toBeCloseTo(-300_000, 5);
  });
});

describe('calculateTaxes — monthsActive proration', () => {
  it('prorates revenue, expenses and the MFP plancher for a half year', () => {
    const r = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 6);
    expect(r.tvaAmount).toBeCloseTo(1_350_000, 5);
    expect(r.isAmount).toBeCloseTo(2_062_500, 5);
    expect(r.netIncome).toBeCloseTo(5_437_500, 5); // 7.5M profit - 2,062,500 IS
  });

  it('handles a single active month', () => {
    const r = calculateTaxes(60_000_000, 10_000_000, 'RNI', true, 1);
    expect(r.tvaAmount).toBeCloseTo(750_000, 5);
    expect(r.isAmount).toBeCloseTo(1_145_833.333333, 2);
    expect(r.netIncome).toBeCloseTo(3_020_833.333333, 2);
  });
});

describe('calculateTaxes — payroll integration', () => {
  it('adds the gross employer cost to deductible expenses', () => {
    // grossPayroll 6M → employer cost 6M * 1.195 = 7,170,000
    // pExpenses = (5M + 7.17M) = 12.17M, pRevenue = 20M → profit 7.83M
    const r = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 12, 6_000_000);
    expect(r.totalPayrollCost).toBeCloseTo(7_170_000, 5);
    expect(r.tvaAmount).toBeCloseTo(1_409_400, 5);
    expect(r.isAmount).toBeCloseTo(2_153_250, 5);
    expect(r.netIncome).toBeCloseTo(5_676_750, 5); // 7.83M profit - 2,153,250 IS
  });

  it('returns the un-prorated employer cost while prorating the deduction', () => {
    const r = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 6, 6_000_000);
    expect(r.totalPayrollCost).toBeCloseTo(7_170_000, 5); // NOT halved
    // deduction IS halved: pExpenses = (5M + 7.17M) * 0.5 = 6.085M → profit 3.915M
    expect(r.isAmount).toBeCloseTo(1_076_625, 5);
  });

  it('handles a zero payroll without breaking the math', () => {
    const withoutPayroll = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 12, 0);
    expect(withoutPayroll.totalPayrollCost).toBe(0);
    expect(withoutPayroll.isAmount).toBeCloseTo(4_125_000, 5);
  });
});

describe('calculateTaxes — degenerate inputs', () => {
  it('never returns a negative tax amount for a negative revenue', () => {
    const r = calculateTaxes(-1_000_000, 500_000, 'CME', true);
    expect(r.cmeAmount).toBe(0);
    expect(r.isAmount).toBe(0);
    expect(r.tvaAmount).toBe(0);
    expect(r.netIncome).toBe(0);
  });

  it('never returns a negative tax amount for negative expenses', () => {
    const r = calculateTaxes(20_000_000, -5_000_000, 'RSI', true);
    expect(r.cmeAmount).toBe(0);
    expect(r.isAmount).toBeGreaterThanOrEqual(0);
    expect(r.tvaAmount).toBeGreaterThanOrEqual(0);
  });

  it('produces a finite result for NaN-safe inputs', () => {
    // Regression test for the Phase 2.2 NaN guard: NaN used to propagate through
    // profit, TVA and IS and produce a NaN tax declaration.
    const r = calculateTaxes(NaN, 0, 'RSI', true);
    expect(Number.isFinite(r.tvaAmount)).toBe(true);
    expect(Number.isFinite(r.isAmount)).toBe(true);
    expect(Number.isFinite(r.netIncome)).toBe(true);
    expect(r.tvaAmount).toBe(0);
    expect(r.isAmount).toBe(0);
  });

  it('produces a finite result for Infinity inputs', () => {
    const r = calculateTaxes(Infinity, 0, 'RSI', true);
    expect(Number.isFinite(r.tvaAmount)).toBe(true);
    expect(Number.isFinite(r.isAmount)).toBe(true);
    expect(Number.isFinite(r.netIncome)).toBe(true);
  });

  it('coerces a non-finite monthsActive to a full year', () => {
    const full = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 12);
    const broken = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, NaN);
    expect(broken.isAmount).toBeCloseTo(full.isAmount, 5);
    expect(broken.netIncome).toBeCloseTo(full.netIncome, 5);
  });

  it('coerces a non-finite grossPayroll to zero', () => {
    const noPayroll = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 12, 0);
    const broken = calculateTaxes(20_000_000, 5_000_000, 'RSI', true, 12, Infinity);
    expect(broken.totalPayrollCost).toBeCloseTo(noPayroll.totalPayrollCost, 5);
    expect(broken.isAmount).toBeCloseTo(noPayroll.isAmount, 5);
  });

  it('falls back to CME for any non-finite revenue in determineTaxRegime', () => {
    // Infinity would otherwise be classified RNI (the highest tax burden) from a
    // corrupted value — the guard fails safe to the lowest regime instead.
    expect(determineTaxRegime(NaN)).toBe('CME');
    expect(determineTaxRegime(Infinity)).toBe('CME');
    expect(determineTaxRegime(-Infinity)).toBe('CME');
  });

  it('returns UNKNOWN regime untouched', () => {
    const r = calculateTaxes(20_000_000, 5_000_000, 'UNKNOWN' as TaxRegime, true);
    expect(r.regime).toBe('UNKNOWN');
    expect(r.cmeAmount).toBe(0);
    expect(r.isAmount).toBe(0);
    expect(r.tvaAmount).toBe(0);
  });
});

describe('end-to-end regime consistency', () => {
  const cases: Array<{ revenue: number; expected: TaxRegime }> = [
    { revenue: 5_000_000, expected: 'CME' },
    { revenue: 20_000_000, expected: 'RSI' },
    { revenue: 60_000_000, expected: 'RNI' },
  ];

  it.each(cases)('routes $revenue through the right regime', ({ revenue, expected }) => {
    const regime = determineTaxRegime(revenue);
    expect(regime).toBe(expected);
    const result = calculateTaxes(revenue, revenue * 0.25, regime, true);
    expect(result.regime).toBe(expected);
    expect(result.netIncome).toBeGreaterThan(0);
  });
});
