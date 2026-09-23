import { describe, it, expect } from 'vitest';
import { computeHealthScore, computePenalties, WEIGHTS } from '../../lib/healthScore.js';

// A perfectly healthy input; each test changes one category
const clean = () => ({
  complexity: { avgComplexity: 0 },
  vuln: { critical: 0, high: 0, moderate: 0, low: 0 },
  deadcode: { deadCodeRatio: 0 },
  coverage: { coverage: 1 },
  drift: { driftRatio: 0 },
});
const withCat = (cat, report) => ({ ...clean(), [cat]: report });

describe('computeHealthScore', () => {
  it('weights sum to 1, so the worst case is exactly 0', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('a perfect repo scores 100', () => {
    expect(computeHealthScore(clean())).toBe(100);
  });

  it('the worst possible repo scores 0', () => {
    expect(computeHealthScore({
      complexity: { avgComplexity: 999 },
      vuln: { critical: 999 },
      deadcode: { deadCodeRatio: 1 },
      coverage: { coverage: 0 },
      drift: { driftRatio: 1 },
    })).toBe(0);
  });

  describe('complexity', () => {
    it('scales linearly below 10: avg 5 → penalty 50 → −12.5', () => {
      expect(computeHealthScore(withCat('complexity', { avgComplexity: 5 }))).toBe(87.5);
    });
    it('caps at avg 10: 10 and 50 both cost exactly 25 points', () => {
      expect(computeHealthScore(withCat('complexity', { avgComplexity: 10 }))).toBe(75);
      expect(computeHealthScore(withCat('complexity', { avgComplexity: 50 }))).toBe(75);
    });
    it('a report without avgComplexity counts as 0, not NaN', () => {
      expect(computeHealthScore(withCat('complexity', {}))).toBe(100);
    });
  });

  describe('vulnerabilities', () => {
    it('critical=10, high=5, moderate=2 points: 1 of each → penalty 17 → −4.25', () => {
      expect(computeHealthScore(withCat('vuln', { critical: 1, high: 1, moderate: 1 }))).toBe(95.75);
    });
    it('low-severity vulnerabilities are ignored', () => {
      expect(computeHealthScore(withCat('vuln', { low: 500 }))).toBe(100);
    });
    it('caps at 100: exactly 10 criticals and 1000 criticals cost the same 25 points', () => {
      expect(computeHealthScore(withCat('vuln', { critical: 10 }))).toBe(75);
      expect(computeHealthScore(withCat('vuln', { critical: 1000 }))).toBe(75);
    });
  });

  describe('coverage', () => {
    it('0% coverage costs the full 20 points', () => {
      expect(computeHealthScore(withCat('coverage', { coverage: 0 }))).toBe(80);
    });
    it('50% coverage costs 10 points', () => {
      expect(computeHealthScore(withCat('coverage', { coverage: 0.5 }))).toBe(90);
    });
    // Pins down CURRENT behavior, which is a known weakness: a repo with no lcov report
    // scores the same as one with 100% coverage. If this is ever changed, this test should
    // fail and be updated on purpose.
    it('missing coverage (null or undefined) is NOT penalized — same as 100%', () => {
      expect(computeHealthScore(withCat('coverage', { coverage: null }))).toBe(100);
      expect(computeHealthScore(withCat('coverage', {}))).toBe(100);
      expect(computePenalties(withCat('coverage', { coverage: null })).coverage).toBe(0);
    });
  });

  it('dead code and drift ratios scale by their weights (0.15 each)', () => {
    expect(computeHealthScore(withCat('deadcode', { deadCodeRatio: 0.4 }))).toBe(94);
    expect(computeHealthScore(withCat('drift', { driftRatio: 1 }))).toBe(85);
  });

  it('always stays within [0, 100] for any in-range input', () => {
    for (let i = 0; i < 1000; i++) {
      const score = computeHealthScore({
        complexity: { avgComplexity: Math.random() * 40 },
        vuln: { critical: Math.floor(Math.random() * 20), high: Math.floor(Math.random() * 20), moderate: Math.floor(Math.random() * 20) },
        deadcode: { deadCodeRatio: Math.random() },
        coverage: { coverage: Math.random() < 0.2 ? null : Math.random() },
        drift: { driftRatio: Math.random() },
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
